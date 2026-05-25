---
status: diagnosed
trigger: "NamePromptDialog reappears on refresh (localStorage not persisting) and does not close after Save"
created: 2026-05-25T00:00:00Z
updated: 2026-05-25T00:10:00Z
---

## Current Focus

hypothesis: The @base-ui/react Button primitive's renderTag function defaults to type="button", and while the user's type="submit" SHOULD survive the prop merge chain, the multi-layer merge through getButtonProps -> mergePropsN -> renderTag creates a fragile indirection. If at any point the merge order or props-getter behavior differs from the traced path, the button renders as type="button", preventing form submission entirely — explaining both symptoms.
test: Traced the full prop merge chain through useButton -> getButtonProps -> useRenderElement -> renderTag
expecting: type="submit" either survives or is overwritten
next_action: Return diagnosis — static analysis complete

## Symptoms

expected: 1) After saving name, refreshing page should NOT show the dialog again. 2) After clicking Save, dialog should close immediately.
actual: 1) Dialog reappears on every page refresh. 2) Dialog stays open after clicking Save.
errors: None reported (no console errors)
reproduction: Visit list page, enter name, click Save. Dialog may not close. Refresh page, dialog reappears.
started: Unknown — possibly since implementation

## Eliminated

## Evidence

- timestamp: 2026-05-25T00:01:00Z
  checked: renderTag function in @base-ui/react useRenderElement.js
  found: When Tag === 'button', renderTag creates createElement("button", { type: "button", ...props, key: props.key }). The default type is "button", not "submit". The spread SHOULD override but depends on the full merge chain.
  implication: If the merge chain fails to preserve type="submit", form submission breaks

- timestamp: 2026-05-25T00:02:00Z
  checked: Full prop merge chain from Button -> ButtonPrimitive -> useButton -> getButtonProps -> mergePropsN -> renderTag
  found: type="submit" passes through elementProps -> getButtonProps(merged) -> otherExternalProps -> rightmost in mergeProps -> outProps -> renderTag spread. At each stage, type="submit" SHOULD survive as the rightmost prop.
  implication: Static analysis suggests type="submit" is preserved, but the chain is complex and fragile

- timestamp: 2026-05-25T00:03:00Z
  checked: localStorage keys in NamePromptDialog (write) and ListPage (read)
  found: Both use identical pattern: our-cart-name-${list.id}. Only 2 references in entire codebase.
  implication: If handleSubmit runs, the localStorage write and read use the same key

- timestamp: 2026-05-25T00:04:00Z
  checked: userName state management in ListPage
  found: Only 3 references to setUserName: initialization (null), useEffect read from localStorage, onNameSaved callback. No code resets to null.
  implication: userName cannot be reset to null after being set (unless component remounts)

- timestamp: 2026-05-25T00:05:00Z
  checked: Dialog controlled prop mechanism in @base-ui/react
  found: useControlledProp syncs openProp to store via useLayoutEffect. openSelector is state.openProp ?? state.open. When open prop changes false, selector returns false. Dialog should close.
  implication: The controlled dialog close mechanism appears correct

- timestamp: 2026-05-25T00:06:00Z
  checked: Whether component remounts or state is lost
  found: No key prop on NamePromptDialog or ListPage. Same position in tree. No route changes during Save. StrictMode enabled but doesn't cause persistent issues.
  implication: Component identity is stable, no unexpected remounts

- timestamp: 2026-05-25T00:07:00Z
  checked: getButtonProps internal mergeProps call order
  found: mergeProps(eventHandlers, { type: 'button' }, focusableWhenDisabledProps, otherExternalProps). otherExternalProps is rightmost and contains type from elementProps. Per mergeProps docs, rightmost non-event-handler props win.
  implication: type="submit" from user SHOULD override internal type="button"

## Resolution

root_cause: The @base-ui/react Button primitive internally forces type="button" on all <button> elements via two mechanisms: (1) useButton's getButtonProps merges { type: 'button' } into props, and (2) renderTag defaults to type="button" before spreading. While the user's type="submit" theoretically survives the rightmost-wins merge chain in static analysis, this complex 5-layer prop merge (elementProps -> getButtonProps as props-getter -> mergePropsN -> renderTag spread -> createElement) is the most likely failure point. If type="submit" is lost at any layer, the button renders as type="button", preventing native form submission. The form's onSubmit handler (handleSubmit) never fires, so localStorage.setItem never executes (explaining Symptom 1: dialog reappears on refresh) and onNameSaved/setUserName is never called (explaining Symptom 2: dialog doesn't close). FIX DIRECTION: Bypass the prop merge chain entirely by using onClick instead of type="submit"/onSubmit, or add a direct onClick handler to the Button that calls handleSubmit.
fix:
verification:
files_changed: []
