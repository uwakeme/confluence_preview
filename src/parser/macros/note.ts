/**
 * <ac:structured-macro ac:name="note"> | info | warning | tip
 *
 * Thin re-exports of the panel renderers with their variant bound.
 * Kept in a separate file so the registry stays grouped by user-facing
 * macro name.
 */

export {
  renderPanelMacro,
  renderNoteMacro,
  renderInfoMacro,
  renderWarningMacro,
  renderTipMacro,
} from "./panel";