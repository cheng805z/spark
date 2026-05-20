# Security Specification and Audit Plan

This document specifies the security requirements, data invariants, and access control testing matrix for the user-centric Thought card and Settings system.

## 1. Data Invariants
- **UserSettings Isolation**: User customization settings (background, opacity) can only be accessed, created, updated, or deleted by the owner of the user profile (`userId` of path match equals auth UID).
- **Thought Ownership Verification**: Every thought card MUST be linked to the creating user (`userId` parameter inside the payload matches auth UID). No user can write a thought representation into another user's space.
- **Strict Size/Format Sanity**:
  - `content` of thought card cannot exceed 10,000 characters.
  - `cardOpacity` must be a floating point number between 0.0 and 1.0.
  - `timestamp` is immutable after creation.

## 2. The "Dirty Dozen" Malicious Payloads
The following payloads constitute invalid or malicious state transitions that must be blocked at the security layer with `PERMISSION_DENIED`.

1. **Identity Theft Check**: Attempting to read another user's `/users/attacker` settings.
2. **Settings Spoof Check**: Attempting to write a setting with arbitrary high/low `cardOpacity` values like `1.5` or `-0.2`.
3. **Thought Injector Check**: Writing a thought document in another user's subcollection `/users/victim_user_id/thoughts/malicious_card_id`.
4. **Id Poisoning Check**: Attempting to create a thought card with an unreasonably large string ID of 10KB to trigger resource exhaustion.
5. **PII Isolation Leak**: Trying to read thoughts of another user anonymously or without proper email verification check if applicable.
6. **Self-Ownership Spoof**: Setting `userId` inside the thought payload to a victim's UID while logged in as attacker, to make it appear under the victim's name in a query.
7. **Timestamp Alteration Update**: Trying to edit an existing card to change its original creation `timestamp`.
8. **Massive Content Injector**: Posting a card content with 1,000,000 empty string spaces to deplete Firestore storage.
9. **Illegal ID Characters**: Using path IDs containing scripting characters or relative directory traversing markers like `../`.
10. **System Overwrite Attack**: Admin concept bypass - trying to access private details with unauthorized elevated custom credentials.
11. **Type Confusion**: Sending `cardOpacity` of type String (e.g. `"0.5"`) instead of number.
12. **Null Value Bypasses**: Omitting `userId` or `content` from the required fields when performing a creation operation on thoughts.

## 3. Test Runner Definition (Verification Framework)
Below is the outline of tests to verify these access limits:

```typescript
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

// Verification Suite for the Security fortress.
// Ensure all "Dirty Dozen" payloads fail with PERMISSION_DENIED.
// Ensure valid operations succeed for signed-in and correct resource owners.
```
