/** What the /app/ page is doing. Each stage shows only its own controls. */
export enum Stage {
  Connecting = "connecting",
  SignedOut = "signed-out",
  /** The chart couldn't be read, so no form may overwrite it. */
  Unavailable = "unavailable",
  FirstSave = "first-save",
  Viewing = "viewing",
  Editing = "editing",
}
