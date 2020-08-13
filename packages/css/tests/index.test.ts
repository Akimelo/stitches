import { createCss, createTokens, hotReloadingCache } from "../src";

function createStyleSheet(styleTag: HTMLStyleElement): CSSStyleSheet {
  document.querySelector("head")?.appendChild(styleTag);

  const sheet = document.styleSheets[document.styleSheets.length - 1];
  // @ts-ignore
  sheet.ownerNode = styleTag;
  return sheet as any;
}

function createStyleTag(textContent: string): HTMLStyleElement {
  const style = document.createElement("style");
  style.textContent = textContent;
  return style;
}

function createFakeEnv(
  styleTagContents: string[] = [],
  computedStyles: string[] = []
) {
  const styleTags = styleTagContents.map(createStyleTag);
  const styleSheets = styleTags.map(createStyleSheet);

  return {
    getComputedStyle() {
      return computedStyles;
    },
    document: {
      styleSheets,
      // Creates a style tag
      createElement() {
        return createStyleTag("");
      },
      // Only used to grab head
      querySelector() {
        return {
          // Used to append the style, where
          // we add the stylesheet
          appendChild(styleTag: HTMLStyleElement) {
            styleSheets.push(createStyleSheet(styleTag));
          },
          // Only used to count styles
          querySelectorAll() {
            return styleTags;
          },
        };
      },
    },
  };
}

beforeEach(() => {
  hotReloadingCache.clear();
});

describe("createCss", () => {
  test("should create simple atoms", () => {
    const css = createCss({}, null);
    const atoms = css({ color: "red" }) as any;
    const atom = atoms.atoms[0];

    expect(atom.id).toBe("color");
    expect(atom.cssHyphenProp).toEqual("color");
    expect(atom.pseudo).toBe(undefined);
    expect(atom.screen).toBe("");
    expect(atom.value).toBe("red");

    const { styles } = css.getStyles(() => {
      expect(atom.toString()).toBe("_1725676875");

      return "";
    });

    expect(styles.length).toBe(2);
    expect(styles[1].trim()).toBe("/* STITCHES */\n\n._1725676875{color:red;}");
  });
  test("should compose atoms", () => {
    const css = createCss({}, null);
    expect(css({ color: "red", backgroundColor: "blue" }).toString()).toBe(
      "_763805413 _1725676875"
    );
  });
  test("should create tokens", () => {
    const tokens = createTokens({
      colors: {
        RED: "tomato",
      },
    });
    const css = createCss({ tokens }, null);
    const atom = (css({ color: "RED" }) as any).atoms[0];

    expect(atom.id).toBe("color");
    expect(atom.cssHyphenProp).toEqual("color");
    expect(atom.pseudo).toBe(undefined);
    expect(atom.screen).toBe("");
    expect(atom.value).toBe("var(--colors-RED)");

    const { styles } = css.getStyles(() => {
      expect(atom.toString()).toBe("_3389639116");
      return "";
    });

    expect(styles.length).toBe(2);
    expect(styles[1].trim()).toBe(
      "/* STITCHES */\n\n._3389639116{color:var(--colors-RED);}"
    );
  });
  test("should create screens", () => {
    const css = createCss(
      {
        screens: {
          tablet: (rule) => `@media (min-width: 700px) { ${rule} }`,
        },
      },
      null
    );
    const atom = (css({ tablet: { color: "red" } }) as any).atoms[0];
    expect(atom.id).toBe("colortablet");
    expect(atom.cssHyphenProp).toEqual("color");
    expect(atom.pseudo).toBe(undefined);
    expect(atom.screen).toBe("tablet");
    const { styles } = css.getStyles(() => {
      expect(atom.toString()).toBe("_2796359201");
      return "";
    });

    expect(styles.length).toBe(3);
    expect(styles[2].trim()).toBe(
      "/* STITCHES:tablet */\n\n@media (min-width: 700px) { ._2796359201{color:red;} }"
    );
  });
  test("should handle pseudos", () => {
    const css = createCss({}, null);
    const atom = (css({ ":hover": { color: "red" } }) as any).atoms[0];

    expect(atom.id).toBe("color:hover");
    expect(atom.cssHyphenProp).toEqual("color");
    expect(atom.pseudo).toBe(":hover");
    expect(atom.screen).toBe("");
    const { styles } = css.getStyles(() => {
      expect(atom.toString()).toBe("_627048087");
      return "";
    });

    expect(styles.length).toBe(2);
    expect(styles[1].trim()).toBe(
      "/* STITCHES */\n\n._627048087:hover{color:red;}"
    );
  });
  test("should handle specificity", () => {
    const css = createCss({}, null);
    expect(
      css(
        {
          color: "red",
          backgroundColor: "blue",
        },
        {
          backgroundColor: "green",
        }
      ).toString()
    ).toBe("_736532192 _1725676875");
  });
  test("should insert rule only once", () => {
    const css = createCss({}, null);
    const { styles } = css.getStyles(() => {
      expect(css({ color: "red" }).toString()).toBe("_1725676875");
      expect(css({ color: "red" }).toString()).toBe("_1725676875");
      return "";
    });

    expect(styles.length).toBe(2);
    expect(styles[1].trim()).toBe("/* STITCHES */\n\n._1725676875{color:red;}");
  });
  /*
    // I do not think this is necessary, it costs more checking all pseudos than
    // just injecting additional rules
  test("should handle specificity with different but same pseudo", () => {
    const css = createCss({}, null);
    expect(
      css(
        { ":hover:disabled": { color: "red" } },
        { ":disabled:hover": { color: "red" } }
      ).toString()
    ).toBe("_3266759165");
  });
  */
  test("should use simple sequence for classname when browser", () => {
    const fakeEnv = createFakeEnv();
    const css = createCss({}, (fakeEnv as unknown) as Window);
    String(css({ color: "red" }));
    expect(fakeEnv.document.styleSheets[1].cssRules[0].cssText).toBe(
      "._0 {color: red;}"
    );
  });
  test("should inject sheet", () => {
    const fakeEnv = createFakeEnv();
    const css = createCss({}, (fakeEnv as unknown) as Window);
    String(css({ color: "red" }));
    expect(fakeEnv.document.styleSheets.length).toBe(2);
    expect(fakeEnv.document.styleSheets[1].cssRules[0].cssText).toBe(
      "._0 {color: red;}"
    );
  });
  test("should inject screen sheets", () => {
    const fakeEnv = createFakeEnv();
    const css = createCss(
      {
        screens: {
          tablet: (rule) => `@media (min-width: 700px) { ${rule} }`,
        },
      },
      (fakeEnv as unknown) as Window
    );
    String(css({ tablet: { color: "red" } }));
    expect(fakeEnv.document.styleSheets.length).toBe(3);
    expect(fakeEnv.document.styleSheets[2].cssRules[0].cssText).toBe(
      "@media (min-width: 700px) {._0 {color: red;}}"
    );
  });
  test("should allow utils", () => {
    const css = createCss(
      {
        utils: {
          marginX: () => (value: string) => ({
            marginLeft: value,
            marginRight: value,
          }),
        },
      },
      null
    );
    expect(css({ marginX: "1rem" }).toString()).toBe("_4081121629 _97196166");
  });
  test("should ignore undefined atoms", () => {
    const css = createCss({}, null);

    expect(
      // @ts-ignore
      String(css(undefined, null, false, "", { color: "red" }))
    ).toBe("_1725676875");
  });
  test("should allow empty compose call", () => {
    const css = createCss({}, null);
    expect(String(css())).toBe("");
  });
  test("should allow conditional compositions", () => {
    const css = createCss({}, null);
    expect(String(css((false as any) && { color: "red" }))).toBe("");
    expect(String(css(true && { color: "red" }))).toBe("_1725676875");
  });
  test("should allow prefixes", () => {
    const css = createCss(
      {
        prefix: "foo",
      },
      null
    );
    expect(String(css({ color: "red" }))).toBe("foo_1725676875");
  });
  test("should expose override with utility first", () => {
    const css = createCss(
      {
        utilityFirst: true,
        screens: {
          mobile: () => "",
        },
      },
      null
    );
    expect(String(css({ override: { color: "red" } }))).toBe("_1725676875");
  });
  test("should not inject existing styles", () => {
    const serverCss = createCss({}, null);
    const { styles } = serverCss.getStyles(() => {
      serverCss({ color: "red" }).toString();
      return "";
    });

    const fakeEnv = createFakeEnv(styles);
    hotReloadingCache.clear();
    const clientCss = createCss({}, fakeEnv as any);
    // Lets see what is already put in
    expect(fakeEnv.document.styleSheets.length).toBe(2);
    expect(fakeEnv.document.styleSheets[1].cssRules.length).toBe(1);
    expect(fakeEnv.document.styleSheets[1].cssRules[0].cssText).toBe(
      "._1725676875 {color: red;}"
    );
    // On the client it will rerun the logic (React hydrate etc.)
    clientCss({ color: "red" }).toString();
    // Then we add something new
    clientCss({ color: "blue" }).toString();
    // Lets see if it continues on the correct sequence

    expect(fakeEnv.document.styleSheets[1].cssRules.length).toBe(2);
    expect(fakeEnv.document.styleSheets[1].cssRules[0].cssText).toBe(
      "._1757807590 {color: blue;}"
    );
  });
  test("should be able to show friendly classnames", () => {
    const css = createCss(
      {
        showFriendlyClassnames: true,
      },
      null
    );
    const { styles } = css.getStyles(() => {
      css({ color: "red" }).toString();
      css({ backgroundColor: "red" }).toString();
      return "";
    });

    expect(styles).toEqual([
      `/* STITCHES:__variables__ */\n\n:root{}`,
      `/* STITCHES */\n\n.c_1725676875{color:red;}\n.bc_1056962344{background-color:red;}`,
    ]);
  });
  test("should inject vendor prefix where explicitly stating so", () => {
    const css = createCss(
      {
        showFriendlyClassnames: true,
      },
      null
    );
    const { styles } = css.getStyles(() => {
      // @ts-ignore
      css({ WebkitColor: "red" }).toString();
      return "";
    });

    expect(styles).toEqual([
      `/* STITCHES:__variables__ */\n\n:root{}`,
      `/* STITCHES */\n\n.c_1725676875{-webkit-color:red;}`,
    ]);
  });
  test("should use specificity props", () => {
    const css = createCss({}, null);
    expect(String(css({ margin: "1px" }))).toBe(
      "_2683736640 _968032303 _4032728388 _4031826548"
    );
  });
  test("should have declarative api", () => {
    const css = createCss({}, null);
    expect(
      css({
        color: "red",
        backgroundColor: "blue",
      }).toString()
    ).toBe("_763805413 _1725676875");
  });
  test("should handle declarative pseudo selector", () => {
    const fakeEnv = createFakeEnv([], []);
    const css = createCss({}, (fakeEnv as unknown) as Window);
    // @ts-ignore
    css({ ":hover": { color: "red" } }).toString();
    expect(fakeEnv.document.styleSheets[1].cssRules[0].cssText).toBe(
      "._0:hover {color: red;}"
    );
  });
  test("should handle screen selector", () => {
    const css = createCss(
      {
        screens: {
          mobile: (className) => `@media(min-width:700px){${className}}`,
        },
      },
      null
    );
    const { styles } = css.getStyles(() => {
      css({ mobile: { color: "red" } }).toString();
      return "";
    });
    // @ts-ignore

    expect(styles.length).toBe(3);
    expect(styles[2].trim()).toBe(
      "/* STITCHES:mobile */\n\n@media(min-width:700px){._2196820011{color:red;}}"
    );
  });
  test("should handle pseudo in screen selector", () => {
    const css = createCss(
      {
        screens: {
          mobile: (className) => `@media(min-width:700px){${className}}`,
        },
      },
      null
    );
    const { styles } = css.getStyles(() => {
      // @ts-ignore
      css({ mobile: { ":hover": { color: "red" } } }).toString();
      return "";
    });

    expect(styles.length).toBe(3);
    expect(styles[2].trim()).toBe(
      "/* STITCHES:mobile */\n\n@media(min-width:700px){._860048247:hover{color:red;}}"
    );
  });
  test("should insert themes", () => {
    const css = createCss(
      {
        tokens: {
          colors: {
            primary: "tomato",
          },
        },
      },
      null
    );
    const { styles } = css.getStyles(() => {
      // @ts-ignore
      css({ color: "primary" }).toString();
      expect(
        css
          .theme({
            colors: {
              primary: "blue",
            },
          })
          .toString()
      ).toBe("theme-0");
      return "";
    });

    expect(styles.length).toBe(2);
    expect(styles).toEqual([
      "/* STITCHES:__variables__ */\n\n:root{--colors-primary:tomato;}\n.theme-0{--colors-primary:blue;}",
      "/* STITCHES */\n\n._221333491{color:var(--colors-primary);}",
    ]);
  });
  test("should allow nested pseudo", () => {
    const css = createCss({}, null);
    const atom = css({ ":hover": { ":disabled": { color: "red" } } }) as any;

    const { styles } = css.getStyles(() => {
      expect(atom.toString()).toBe("_3266759165");

      return "";
    });

    expect(styles.length).toBe(2);
    expect(styles[1].trim()).toBe(
      "/* STITCHES */\n\n._3266759165:hover:disabled{color:red;}"
    );
  });
  test("should handle border specificity", () => {
    const css = createCss({}, null);
    const atom = css({ border: "1px solid red" }) as any;

    const { styles } = css.getStyles(() => {
      expect(atom.toString()).toBe(
        "_3699842268 _4258539560 _3162928263 _2026632940 _1405295864 _397589452 _3971615587 _1515315272 _1917871437 _115517177 _3001088182 _1146082397"
      );

      return "";
    });

    expect(styles.length).toBe(2);
    expect(styles[1].trim()).toBe(
      "/* STITCHES */\n\n._3699842268{border-left-color:red;}\n._4258539560{border-bottom-color:red;}\n._3162928263{border-right-color:red;}\n._2026632940{border-top-color:red;}\n._1405295864{border-left-style:solid;}\n._397589452{border-bottom-style:solid;}\n._3971615587{border-right-style:solid;}\n._1515315272{border-top-style:solid;}\n._1917871437{border-left-width:1px;}\n._115517177{border-bottom-width:1px;}\n._3001088182{border-right-width:1px;}\n._1146082397{border-top-width:1px;}"
    );
  });
  test("should handle border array definition with token", () => {
    const css = createCss(
      {
        tokens: {
          colors: {
            primary: "tomato",
          },
        },
      },
      null
    );
    const atom = css({ border: ["1px", "solid", "primary"] }) as any;

    const { styles } = css.getStyles(() => {
      expect(atom.toString()).toBe(
        "_37328740 _3671545168 _150089599 _4079361620 _1405295864 _397589452 _3971615587 _1515315272 _1917871437 _115517177 _3001088182 _1146082397"
      );

      return "";
    });

    expect(styles.length).toBe(2);
    expect(styles[1].trim()).toBe(
      "/* STITCHES */\n\n._37328740{border-left-color:var(--colors-primary);}\n._3671545168{border-bottom-color:var(--colors-primary);}\n._150089599{border-right-color:var(--colors-primary);}\n._4079361620{border-top-color:var(--colors-primary);}\n._1405295864{border-left-style:solid;}\n._397589452{border-bottom-style:solid;}\n._3971615587{border-right-style:solid;}\n._1515315272{border-top-style:solid;}\n._1917871437{border-left-width:1px;}\n._115517177{border-bottom-width:1px;}\n._3001088182{border-right-width:1px;}\n._1146082397{border-top-width:1px;}"
    );
  });
  test("should handle box shadow array with token", () => {
    const css = createCss(
      {
        tokens: {
          colors: {
            primary: "tomato",
          },
        },
      },
      null
    );
    const atom = css({ boxShadow: ["1px", "1px", "1px", "primary"] }) as any;

    const { styles } = css.getStyles(() => {
      expect(atom.toString()).toBe("_3532244265");

      return "";
    });

    expect(styles.length).toBe(2);
    expect(styles[1].trim()).toBe(
      "/* STITCHES */\n\n._3532244265{box-shadow:1px 1px 1px var(--colors-primary);}"
    );
  });
  test("should be able to compose themes", () => {
    const css = createCss(
      {
        tokens: {
          colors: {
            primary: "tomato",
          },
        },
      },
      null
    );
    const darkTheme = css.theme({
      colors: {
        primary: "green",
      },
    });
    const atom = css(darkTheme, {
      color: "primary",
    }) as any;

    const { styles } = css.getStyles(() => {
      expect(atom.toString()).toBe("_221333491 theme-0");

      return "";
    });

    expect(styles.length).toBe(2);
    expect(styles[1].trim()).toBe(
      "/* STITCHES */\n\n._221333491{color:var(--colors-primary);}"
    );
  });
});
