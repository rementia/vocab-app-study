# AGENTS.md

## Purpose

This file defines project-specific instructions for Codex when working on this repository.

This repository is the study / experimental version of the English vocabulary web app.

The project is used for:
- Learning web development
- Testing new features before copying them to the portfolio version
- Understanding JavaScript, DOM behavior, Firebase, Firestore, localStorage, and Git workflows
- Trying UI and state-management changes safely
- Comparing experimental code with the public portfolio version

Codex should help the owner learn deeply while keeping experiments controlled, reversible, and well explained.

---

## Repository role

This repository is not the primary public portfolio version.

Assume the related public/stable repository may be named something like:
- vocab-app

Assume this repository may be named something like:
- vocab-app-study

The study repository may contain experimental code, temporary tests, or unfinished ideas.

However, experiments should still be:
- Understandable
- Reversible
- Isolated when possible
- Documented clearly
- Safe to compare with the stable version

When a change might be useful for the portfolio version, explain whether it is:
- Ready to copy to the portfolio version
- Needs more testing
- Only useful as a learning experiment
- Risky and should not be copied yet

---

## Project summary

This is a static frontend web app.

Primary technologies:
- HTML
- CSS
- JavaScript
- Firebase Authentication
- Cloud Firestore
- GitHub Pages, if deployment is enabled
- localStorage, if used for fallback or non-login behavior

This repository should generally remain a static frontend project.

Do not introduce a traditional backend server, framework, build system, package manager, or large dependency unless explicitly requested.

---

## Core development policy

Prioritize the following:

1. Learning and understanding
2. Controlled experimentation
3. Small, reversible changes
4. Clear separation between experiment and stable behavior
5. Preserving reusable working code
6. Explaining internal behavior
7. Avoiding accidental damage to Firebase, Firestore, localStorage, or GitHub Pages compatibility

Because this is a study repository, experimental changes are allowed.

However, before making broad or risky changes, explain:
- What is being tested
- Why the experiment is useful
- Which files will be affected
- Which behavior may break
- How to revert or isolate the change
- Whether this should later be copied to the portfolio version

---

## Difference from the portfolio repository

For the portfolio repository:
- Stability matters most
- Existing behavior should be preserved strongly
- Public-facing documentation should be careful
- Copyright/privacy risk should be minimized
- UI should be polished

For this study repository:
- Experiments are allowed
- Debugging code may be added temporarily
- UI alternatives may be tested
- Refactoring may be explored
- New feature prototypes may be created

Even in this study repository, do not make careless large rewrites.

Prefer:
- Feature branches
- Small commits
- Clearly named experimental sections
- Easy rollback
- Notes explaining what changed and why

---

## Do not do these unless explicitly requested

Do not:
- Remove existing features without explaining the reason
- Delete working code just because it looks unused, unless verified
- Perform broad refactoring without a clear goal
- Introduce React, Vue, TypeScript, Vite, Webpack, npm, Node.js, or a backend server without explicit request
- Change Firebase project assumptions casually
- Change Firestore collection paths without explaining migration impact
- Mix study data with portfolio/public data
- Weaken authentication or authorization assumptions
- Expose private data, protected data, or sensitive URLs
- Add unnecessary dependencies
- Break static hosting compatibility without warning
- Hide uncertainty

---

## Important existing features to preserve or track

Even though this is a study repository, track the impact on these features:

- Level-based vocabulary display, such as vol.1, vol.2, vol.3, vol.4
- Current word display
- Progress display
- Favorite toggle using star UI
- Favorites list
- Random mode
- Pronunciation button
- Auto pronunciation behavior
- Recall learning mode
- Recall time UI or timer behavior, if present
- Keyboard shortcuts, if present
- Mobile layout
- Landscape phone layout
- Google login using Firebase Authentication
- Firestore-based per-user saved data
- localStorage behavior for non-login or fallback usage, if present

If an experiment intentionally breaks one of these, clearly say:
- What is broken
- Why it is acceptable for the experiment
- How to restore the previous behavior
- Whether this breakage is acceptable for the portfolio version

---

## Experimental change rules

When implementing an experiment:

1. State the experiment goal.
2. Keep the patch as small as possible.
3. Avoid mixing multiple unrelated experiments in one change.
4. Add comments only where they clarify non-obvious behavior.
5. Prefer feature flags, separate functions, or isolated branches when useful.
6. Avoid permanently replacing stable behavior until the experiment is verified.
7. Explain how to compare before/after behavior.
8. Explain what should be tested manually.
9. Explain whether the result is suitable for the portfolio version.

Good experiment examples:
- Testing a new recall-time control
- Testing a different mobile header layout
- Testing a cache for failed pronunciation lookups
- Testing Firestore/localStorage separation
- Testing random mode behavior
- Testing favorites behavior after login/logout
- Testing viewport/orientation handling

Bad experiment examples:
- Rewriting the entire app without need
- Mixing UI redesign, Firebase changes, and state refactoring at once
- Removing working code without verification
- Changing data paths without migration thinking

---

## JavaScript rules

When modifying JavaScript:

- Prefer minimal patches unless the task explicitly asks for refactoring.
- Preserve existing behavior unless the experiment requires a change.
- Be careful with global variables.
- Be careful with event listeners.
- Be careful with DOM references.
- Be careful with asynchronous operations.
- Be careful with Firebase imports and initialization.
- Avoid duplicate event listeners.
- Avoid creating render loops or repeated unnecessary network requests.
- Avoid causing pronunciation or auto-pronunciation to trigger unexpectedly.
- Avoid mixing state between normal mode, random mode, favorites mode, and recall mode.
- Avoid hiding bugs by adding broad try/catch blocks without explanation.

When explaining JavaScript changes, include:
- Execution flow
- State changes
- Data structures
- DOM updates
- Event timing
- Asynchronous timing
- Possible side effects

If a variable or function is deleted or renamed, explain:
- What it was used for
- How you verified it is safe to change
- What code references were checked
- What manual tests are needed

---

## State management rules

Be especially careful with application state.

Track these state categories when relevant:
- Current selected volume
- Current word index
- Current word object
- Current mode
- Random mode state
- Favorite state
- Favorites list state
- Login state
- Firestore synchronization state
- localStorage fallback state
- UI rendering state
- Speech/pronunciation state
- Recall learning state
- Timer state
- Viewport/orientation state

When changing state logic, explain:
- Which state changes
- When it changes
- Which functions read it
- Which functions write it
- Which UI elements depend on it
- Whether it persists to Firestore or localStorage

---

## DOM rules

DOM means Document Object Model.

When changing DOM logic:
- Preserve element IDs and classes used by JavaScript unless all references are updated.
- Avoid querying DOM elements repeatedly if a stable reference already exists.
- Avoid using undefined DOM references.
- Avoid updating elements before they exist.
- Avoid rendering stale state.
- Keep event handlers connected to the correct elements.

If an error involves a DOM element, explain:
- Which element is missing or undefined
- Which function expects it
- When the function runs
- Why the timing or selector causes the problem
- How to fix it safely

---

## HTML rules

When modifying HTML:

- Preserve IDs and classes used by JavaScript and CSS.
- Keep the structure compatible with existing layout logic.
- Avoid adding unnecessary external resources.
- Avoid server-only assumptions.
- Keep GitHub Pages compatibility.
- Keep button labels and UI text understandable.
- Do not remove accessibility-relevant text without reason.

If an ID or class is changed, list:
- HTML element changed
- JavaScript references affected
- CSS references affected
- Manual tests needed

---

## CSS rules

When modifying CSS:

- Prefer targeted fixes over broad layout rewrites.
- Preserve the current visual intent unless testing a redesign.
- Be especially careful with mobile portrait and mobile landscape layouts.
- Avoid changes that make header controls overflow, wrap badly, or shift unexpectedly.
- Avoid unnecessary global resets.
- Be careful with viewport height, dynamic browser UI, safe areas, and orientation changes.
- Do not make one button visually heavier than others unless intended.
- Keep touch targets usable on mobile.

When testing mobile layout experiments, consider:
- Small iPhone screens
- Landscape phone screens
- Header height
- Button wrapping
- Central content stability
- Progress display position
- Favorite star placement
- Recall UI placement
- Pronunciation button placement
- Browser address bar behavior
- Orientation changes

If a CSS experiment is not suitable for the portfolio version, say so clearly.

---

## Firebase Authentication rules

When modifying authentication logic:

- Preserve Google login behavior unless explicitly testing an alternative.
- Distinguish clearly between Firebase/Google login and GitHub login.
- Do not assume GitHub login is related to app login.
- Use Firebase UID for user-specific data separation when relevant.
- Do not store unnecessary personal data.
- Do not expose private user information in UI or documentation.
- Be careful with logout behavior.
- Be careful with post-login state restoration.
- Be careful when switching between study and portfolio app contexts.

When explaining authentication changes, include:
- What is stored
- Where it is stored
- When it is read
- When it is written
- What happens when the user is logged out
- Whether study and portfolio data remain separated

---

## Firestore rules

When modifying Cloud Firestore logic:

- Be careful with collection paths.
- Be careful with document IDs.
- Be careful with per-user data separation.
- Be careful with read/write frequency.
- Do not weaken security assumptions.
- Do not move data between collections without explaining migration impact.
- Do not mix study data and portfolio/public data unless explicitly requested.
- Avoid unnecessary reads and writes.
- Avoid writing on every small UI change unless there is a clear reason.
- Be careful with offline or failed-write behavior.

When explaining Firestore changes, include:
- Collection path
- Document path
- Read timing
- Write timing
- Data shape
- Possible quota impact
- Behavior when offline
- Behavior when unauthenticated
- Whether existing user data needs migration

---

## localStorage rules

When modifying localStorage logic:

- Preserve fallback behavior unless explicitly requested.
- Do not mix unrelated app contexts.
- Avoid overwriting user data unexpectedly.
- Be careful with saved volume, saved mode, favorites, progress, and recall settings.
- Explain how localStorage and Firestore interact if both are used.
- Be especially careful if the study and portfolio versions are opened in the same browser.

When changing storage keys, explain:
- Old key
- New key
- Whether migration is needed
- What happens to existing users
- Whether the portfolio version is affected

---

## Study vs portfolio data separation

Because the owner may use both a study version and a portfolio/public version, data separation matters.

When modifying saved data logic, consider:
- Are both versions using the same Firebase project?
- Are both versions using the same Firestore collection?
- Are both versions using the same UID?
- Are both versions using the same localStorage keys?
- Could favorites or progress leak between versions?
- Should the study version use different collection names or key prefixes?

If there is a risk of cross-contamination, explain it clearly and propose a safer separation.

---

## Vocabulary data rules

The app may use vocabulary data from protected, private, or indirect sources.

When modifying vocabulary loading logic:
- Do not expose protected source URLs unnecessarily.
- Do not hard-code private vocabulary data into public files unless explicitly requested.
- Preserve volume mapping behavior.
- Preserve data shape expected by the UI.
- Be careful with CSV/JSON parsing.
- Be careful with missing fields.
- Handle loading errors clearly.
- Explain any caching behavior.

If adding caching, explain:
- What is cached
- Where it is cached
- How long it is cached
- When it is refreshed
- What happens when data is missing or invalid
- Whether failed lookups are cached temporarily or permanently

---

## Pronunciation and speech rules

When modifying pronunciation logic:

- Avoid triggering speech unexpectedly.
- Avoid repeated unnecessary API calls or lookups.
- Avoid repeated speech when toggling unrelated UI controls.
- Keep manual pronunciation and auto-pronunciation behavior distinct.
- Be careful when switching words, volumes, favorites, random mode, or recall mode.
- Be careful with browser speech synthesis timing.

When explaining pronunciation changes, include:
- What triggers pronunciation
- What should not trigger pronunciation
- Whether the behavior is manual or automatic
- Whether failed pronunciation lookups are cached
- How the user can test it

---

## Random mode rules

When modifying random mode:

- Keep random mode scoped correctly.
- Avoid mixing words from unintended volumes unless explicitly intended.
- Preserve progress display behavior if random mode intentionally hides or changes progress.
- Be careful when switching between volumes while random mode is on.
- Be careful when combining random mode with favorites mode.

When explaining random mode changes, include:
- Source list of words
- Selection timing
- Whether duplicates are allowed
- How current volume affects random selection
- How favorites mode affects random selection

---

## Favorites rules

When modifying favorites:

- Preserve star toggle behavior.
- Preserve favorites list behavior.
- Preserve per-user Firestore favorites if logged in.
- Preserve localStorage favorites if used while logged out.
- Avoid mixing favorites between study and portfolio contexts.
- Be careful when logging in or out from the favorites view.
- Be careful when toggling favorites during random mode or recall mode.

When explaining favorites changes, include:
- Where favorite state is stored
- How favorite state is loaded
- How favorite state is saved
- What happens when logged out
- What happens after login
- What happens after logout

---

## Recall learning rules

When modifying recall learning mode:

- Preserve existing recall behavior unless the task asks for a change.
- Be careful with timers.
- Be careful with UI controls that set recall time.
- Avoid triggering auto-pronunciation merely by changing recall settings unless intended.
- Be careful with state restoration after leaving recall mode.
- Keep mobile layout usable.

When explaining recall changes, include:
- Recall mode entry condition
- Timer behavior
- State changes
- UI updates
- Interaction with pronunciation
- Interaction with favorites
- Interaction with random mode

---

## Git and branch workflow

Because this is a study repository, experiments should preferably be done in branches.

Recommended branch names:
- feature/short-description
- fix/short-description
- refactor/short-description
- experiment/short-description
- study/short-description
- docs/short-description

Use:
- feature/ for new features intended to be kept
- fix/ for bug fixes
- refactor/ for structure-only changes
- experiment/ for uncertain trials
- study/ for learning-focused changes
- docs/ for documentation-only changes

For large changes, recommend committing in small logical steps.

A good commit should represent one meaningful unit of work.

Avoid mixing unrelated changes in one commit.

---

## Debugging rules

When debugging:

1. Identify the symptom.
2. Identify the likely trigger.
3. Identify the internal cause.
4. Locate the responsible function or state.
5. Propose the smallest safe fix.
6. Explain how to verify the fix.

For console errors, explain:
- Error message
- Meaning
- Where it occurs
- Why it occurs
- What internal state or reference is invalid
- Fix
- Manual test

For network or Firebase errors, explain:
- Request or operation
- Authentication state
- Firestore path, if relevant
- Rules or permission possibility
- Data shape possibility
- How to test safely

---

## Documentation rules

When editing README or other documentation in this study repository:

- Make clear if the repository is experimental.
- Avoid presenting unfinished experiments as production-ready.
- Keep notes useful for the owner’s learning.
- Mention which experiments may be copied to the portfolio version.
- Avoid overclaiming security, privacy, or legal safety.
- Avoid exposing sensitive URLs or protected data.

Good study documentation may include:
- What was tested
- Why it was tested
- What worked
- What did not work
- What should be copied to the portfolio version
- What should be avoided

---

## Copyright and portfolio caution

This project may involve vocabulary lists, translations, classifications, or ordering with copyright or database-related concerns.

When editing data loading, README, documentation, or demo behavior:
- Avoid implying protected vocabulary content is freely redistributable.
- Avoid publishing protected word lists, translations, order, or classifications unless explicitly confirmed safe.
- Prefer describing app structure and functionality rather than exposing protected content.
- For portfolio use, emphasize implementation, UI, authentication, storage design, and learning features.

Do not give legal conclusions as certainty.

If legal risk is discussed, separate:
- Confirmed facts
- General legal concepts
- Practical risk-reduction advice
- Uncertain points

---

## Security and privacy rules

Do not include secrets in code or documentation.

Do not write:
- Private API keys
- Secret tokens
- Private Google Apps Script URLs
- Personal email addresses
- Firebase UID allowlists
- Private Firestore paths that should not be public
- Protected vocabulary content

If a secret or sensitive value appears in the repository:
- Do not reuse it casually
- Recommend removing it
- Recommend rotating it if needed
- Recommend checking Git history if it was committed

For privacy-related documentation, use careful wording and avoid overclaiming.

---

## Manual test checklist

After changes, suggest only the tests relevant to the change.

Possible tests include:
- Load the app locally
- Load the app on GitHub Pages, if deployed
- Test desktop layout
- Test mobile portrait layout
- Test mobile landscape layout
- Switch between vol.1 to vol.4
- Toggle Random mode
- Switch volumes while Random mode is on
- Toggle Favorites
- Open Favorites list
- Log in with Google
- Log out
- Test Firestore save/load behavior
- Test localStorage fallback behavior
- Use pronunciation button
- Check auto-pronunciation behavior
- Enter recall learning mode
- Change recall time
- Leave recall learning mode
- Check console for errors
- Compare behavior with the portfolio version

For experiments, also test:
- Before/after behavior
- Revert path
- Whether the feature should be copied to the portfolio version

---

## Code review response format

When reviewing code, use this structure:

1. Conclusion
2. Problem
3. Cause
4. Fix
5. Side effects
6. Manual test checklist

For bugs, explain:
- Cause
- Trigger condition
- What happens internally
- How to fix it
- How to verify the fix

For comparisons, prefer tables.

For uncertain issues, separate:
- Confirmed facts
- Assumptions
- General advice

---

## Change summary format

After making changes, summarize:

- Files changed
- Main changes
- Experiment goal, if any
- Behavior preserved
- Behavior intentionally changed
- Possible side effects
- Whether this is suitable for the portfolio version
- Manual test checklist

---

## Preferred explanation style

The owner prefers explanations that are:
- In Japanese when explaining concepts
- Structured
- Precise
- Focused on why something works
- Focused on internal behavior
- Useful for interviews and learning

Use this order when explaining:
1. Conclusion
2. Reason
3. Concrete example

When using technical terms, explain the full name and meaning when useful.

Examples:
- DOM = Document Object Model
- UID = User Identifier
- API = Application Programming Interface
- SDK = Software Development Kit
- PWA = Progressive Web App
- SPA = Single Page Application

---

## Final instruction

This is a study repository, so experiments are allowed.

However, do not experiment carelessly.

Prefer controlled, reversible, well-explained changes.

Help the owner understand:
- What changed
- Why it changed
- How it works internally
- What may break
- Whether it should be copied to the portfolio version
