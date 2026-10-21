import assert from "node:assert/strict";
import { test } from "node:test";
import { appendImage, textWithImages, textWithoutImages } from "./index.ts";

const image = { fileId: "file_abc", name: "Site photo" };

test("typing a trailing space survives the controlled round-trip", () => {
  // Every keystroke flows value -> textWithoutImages (display) and
  // input -> textWithImages (state); any trimming here eats the space as typed.
  let state = "";
  for (const next of ["o", "on", "on ", "on s", "on site ", "on site w"]) {
    state = textWithImages(next, state);
    assert.equal(textWithoutImages(state), next);
  }
});

test("newlines and interior spacing are preserved verbatim", () => {
  const typed = "line one  \n\nline two ";
  assert.equal(textWithoutImages(textWithImages(typed, "")), typed);
});

test("stripping an image removes the separator appendImage added, nothing else", () => {
  const withImage = appendImage("notes ", image);
  assert.equal(textWithoutImages(withImage), "notes ");
  assert.equal(textWithoutImages(appendImage("", image)), "");
});

test("round-trip keeps the image while the user keeps typing", () => {
  let state = appendImage("hello", image);
  state = textWithImages("hello world ", state);
  assert.equal(textWithoutImages(state), "hello world ");
  assert.match(state, /!\[Site photo\]\(\/files\/file_abc\/download\)/);
});
