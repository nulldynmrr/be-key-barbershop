const { getStyleSilhouetteHint } = require("../services/ai/utils/tryOnStyleHints");

describe("tryOnStyleHints", () => {
  it("returns french crop hint for common labels", () => {
    const h = getStyleSilhouetteHint("French Crop Fade");
    expect(h).toBeTruthy();
    expect(h.toLowerCase()).toContain("fringe");
  });

  it("returns generic fallback for unknown style", () => {
    expect(getStyleSilhouetteHint("")).toBeNull();
  });
});
