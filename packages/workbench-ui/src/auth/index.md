# Auth Module

## Purpose

Authentication UI and signed-in migration prompts shared by host surfaces that
use `WorkbenchDataProvider`.

## Structure

- `AuthMenu.tsx` renders the header account trigger, sign-in/sign-up dialog, and
  signed-in account actions through the injected Better Auth client.
- `AuthForm.tsx` owns email/password and Google sign-in forms.
- `ImportLocalDataPrompt.tsx` checks for anonymous IndexedDB workflows after a
  user signs in, offers to import them into the account, deletes successfully
  imported local records, and asks the data provider to refresh workflow lists.

## Behavior

`ImportLocalDataPrompt` must be rendered inside `WorkbenchDataProvider`. It is a
shared overlay prompt used by both `AppWorkbench` and product-level shells such
as the web homepage so signed-in users can recover workflows created while
anonymous without duplicating import logic.
