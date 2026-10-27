import { describe, expect, it } from "vitest";
import { learningPoints } from "@/lib/content/learning-points";

const texts = (list: { text: string }[]) => list.map((p) => p.text);

describe("learningPoints", () => {
  it("takes the lessons' recap points in turns, at most five", () => {
    const lessons = [
      { title: "One", points: ["a1", "a2", "a3"] },
      { title: "Two", points: ["b1", "b2", "b3"] },
    ];
    expect(texts(learningPoints(lessons))).toEqual(["a1", "b1", "a2", "b2", "a3"]);
  });

  it("skips repeats, blanks and anything that is not text", () => {
    expect(texts(learningPoints([{ title: "One", points: ["Report it.", " ", 4, null, "Report it.", " Check the sender. "] }]))).toEqual(["Report it.", "Check the sender.", "One"]);
  });

  it("tops up with lesson titles when the recaps give fewer than three points", () => {
    const lessons = [
      { title: "Spot the sender", points: ["Look at the domain."] },
      { title: "Report it" },
      { title: "Lock the account", points: "not a list" },
      { title: "Never shown" },
    ];
    expect(texts(learningPoints(lessons))).toEqual(["Look at the domain.", "Spot the sender", "Report it"]);
  });

  it("keeps the language of points that come from another locale's text", () => {
    expect(learningPoints([{ title: "Bir", points: ["Check it."], lang: "en" }])).toEqual([{ text: "Check it.", lang: "en" }, { text: "Bir", lang: undefined }]);
  });

  it("returns nothing for a module without lessons", () => {
    expect(learningPoints([])).toEqual([]);
  });
});
