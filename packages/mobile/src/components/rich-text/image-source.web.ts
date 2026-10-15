/** The web editor accepts blob URLs. Their lifetime is limited to this field. */
export function editorImageSource(dataUrl: string) {
  const match = /^data:(image\/[a-z+.-]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error("Could not read the saved image.");
  const bytes = Uint8Array.from(atob(match[2]!), (char) => char.charCodeAt(0));
  const uri = URL.createObjectURL(new Blob([bytes], { type: match[1] }));
  return { uri, dispose: () => URL.revokeObjectURL(uri) };
}
