# ADR 0008 — Customer accounts, keyed on a phone number

**Status:** accepted · **Date:** 2026-08-26

## Context

Until now there was no customer login at all. Every order was a guest checkout
with `customer_id` null, and the only way back to an order was the receipt URL.
The `customers` and `addresses` tables existed with user-scoped RLS and no UI.

## Phone, not email

The account is a Malaysian mobile number and a password.

Email is the web's default and it is the wrong default here. A customer in this
market gives you a number, expects to hear from you on WhatsApp, and may not
have an email address they check. Supabase Auth stores phone numbers in E.164,
which is also exactly what `wa.me` wants — so **the number they sign in with is
the number the shop messages**, with no second field to keep in sync.

Staff keep email. An admin is not a customer (ADR 0006), and the two are now
distinguishable at the database: `handle_new_customer()` creates a `customers`
row only when the new auth user has a phone, so a staff account can never
acquire a shopping profile by accident.

### One person, one account

Malaysians write their number half a dozen ways — `012-345 6789`, `0123456789`,
`+60 12 345 6789` — and every one has to reach the same row, or the same
customer quietly ends up with three. `normalise_my_phone()` in the database is
the authority; `lib/account/phone.ts` mirrors it so the customer finds out their
number is wrong while typing rather than after a round trip. The field itself
does the rest — see [The phone field](#the-phone-field-is-one-component-used-three-times).

Landlines are rejected on purpose: delivery updates and the whole support
channel run on WhatsApp.

The first version of the rule was wrong and rejected every **011** number, one
of the most common prefixes. 011 and 015 carry one digit more than the rest, so
the E.164 tail is 9 **or** 10 digits. Fixed in migration 0019 rather than by
editing 0018 — the applied history is a record of what ran.

## No OTP — decided, not deferred

Signing up and signing in are the phone number and a password. There is no SMS
step and none is planned; this was confirmed as the intended design rather than
a limitation to work around later.

The consequence is that **the number is unverified**: anyone can register with
anyone's number. Nothing behind the login is sensitive — order history is the
only thing there, and a customer could already see any of it with a receipt URL
— so the unverified number costs little on its own. Where it does bite is
linking old orders to a new account, and that needed a different answer rather
than a wait for OTP.

### Claiming orders by the receipt link, not by the number

Matching a new account to past orders **by phone** stays out, permanently. The
phone is unverified and order numbers are sequential (`EP-2608-1012`), so
"you know the number" and "you know the order number" are two guessable things,
not two secrets.

But a real secret already exists: **the order id**. 122 bits, handed to exactly
one person at checkout, never listed anywhere, and already the entire basis of
the receipt page. So `claim_order()` asks only two questions — are you signed
in, and do you have the link? Someone holding it can already read the order;
claiming grants nothing new, it just means they stop needing to keep the link.

The receipt offers it to a signed-in customer whose account does not already own
the order. Verified at the database:

| Caller | Result |
|---|---|
| The claimer, order unclaimed | `true`; the order appears in their account |
| The same customer again | `true` — idempotent, so a double click is harmless |
| A different customer | `false`, and the order stays invisible to them |
| An admin session | refused — staff have no `customers` row |
| `anon` | refused; EXECUTE is not granted |

The third row is the one that matters: a forwarded link must not let the
recipient take the order off the person who bought it.

### Password reset still has no answer

It genuinely needs a channel to send something to, and there is none. A customer
who forgets their password has to contact the shop. Worth solving with a
WhatsApp link rather than SMS, given where the conversation already happens.

## Supabase's phone identity is not used, and that is the point

The obvious implementation is `signInWithPassword({ phone })`. It was the first
one, and it does not work here: Supabase ties its `phone` identity type to the
SMS subsystem, and **the Phone provider will not save without an SMS provider
configured** — Twilio Account SID, Auth Token and Message Service SID are all
required fields — *even with confirmations switched off and nothing ever sent*.

Configuring Twilio credentials that will never be called, to support an OTP that
is explicitly not wanted, is the tail wagging the dog. So that subsystem is
skipped entirely:

| | |
|---|---|
| Customer types | `012-345 6789` |
| `customers.phone` | `+60123456789` — the real number, used everywhere |
| `auth.users.email` | `60123456789@phone.ecoplants.my` — an internal key |

The synthetic address is never shown, never typed, and never sent to. It exists
because Supabase needs a unique string to key an identity on, and a phone number
is a perfectly good one. The subdomain is load-bearing: staff are keyed the same
way on `@staff.ecoplants.my` (ADR 0006), so the two namespaces cannot overlap,
and neither can collide with a real mailbox on `ecoplants.my` itself.

**No SMS provider, no OTP, and no unused third-party credentials in the config.**

Two consequences worth stating:

- **The staff/customer discriminator moved.** It used to be "has a phone =
  customer". Every auth user now has an address, so it is "has a phone in the
  signup metadata = customer" (migration 0023). Staff are provisioned
  server-side without that metadata and still never acquire a shopping profile
  — verified: the `admin` account has no `customers` row.
- **Uniqueness moved with it.** One account per number used to be implied by
  `auth.users.phone` being unique. `customers.phone` now carries its own unique
  index.

The trigger re-normalises the metadata number rather than trusting it, so a
client that bypasses the form still cannot create an account on a malformed
number.

The only dashboard requirement left is that **email signups are enabled with
confirmations off** — which is how the project already stands. If confirmations
are ever switched on, signup returns a clear message rather than bouncing the
customer between `/account` and `/login`.

## The header does not know who you are

The account icon links to `/account` unconditionally, and `/account` redirects to
`/login` when nobody is signed in.

Reading the session in the header would mean calling `cookies()` in the
storefront layout, which would opt **all 42 prerendered product pages** out of
static rendering — to decide which of two icons to draw. Checkout does read the
session, because prefilling a name and number is the whole point of having an
account, and that is one page rather than forty-two.

## A bug worth recording

`stamp_order_event_actor()` (migration 0011) raised "not an active admin" for any
session that was not an admin. It was written when only staff wrote to
`order_events`. Giving customers accounts meant `place_order()` — which writes a
timeline row — now ran under a customer session, so **a signed-in customer could
not check out at all**. Every earlier test passed because every earlier test was
a guest.

Migration 0020 keeps the trigger's real job (an admin cannot attribute an action
to a colleague) and changes only the else branch: a non-admin session is pinned
to an anonymous `customer` actor rather than refused. Pinned rather than
trusted — if an INSERT policy for customers is ever added, they still cannot
claim to be staff.

The general lesson is the one this ADR exists to record: **a guard written for
one caller becomes a bug the moment a second caller appears**, and it will pass
every test written before that caller existed.

## What is not built

- **Saved addresses.** The `addresses` table has a unique-default index now
  (migration 0018) and no UI. Checkout prefills name and phone only.
- **Password reset**, per above.
- **Matching guest orders to an account by phone number** — permanently out.
  Claiming by the receipt link replaces it.

## The phone field is one component, used three times

Sign in, sign up and checkout share `components/features/phone-field.tsx`,
because the number means the same thing in all three: it is the account, it is
where order updates go, and it is the WhatsApp thread. Three separate fields
would be three chances to disagree about what a number looks like.

- **`+60` is a fixed label, not something to type.** That deletes the "with or
  without the zero, with or without the country code" question from the one
  field where getting it wrong creates a second account.
- **The national part regroups on every keystroke** — `12-345 6789`, or
  `11-1234 5678` for the prefixes carrying an extra digit. Grouping is decided
  by the operator prefix, never by how many digits have been typed, or the field
  would rearrange itself under the cursor halfway through.
- **A leading zero is absorbed, not rejected.** Half of Malaysia types `012…`
  out of habit even when the box says `+60`. Quietly doing the right thing beats
  an error message about a digit we can infer.
- The border turns leaf-green once the number is complete. That is the only
  feedback, and it says nothing to someone mid-way through typing.

`formatPhone` (display) and `formatPhoneInput` (the field) share one grouping
function. They used to decide grouping separately — one by prefix, one by
length — and disagreed about 015 numbers.

## The auth screens are their own route group

`/login` and `/signup` live in `app/[locale]/(auth)/`, not under
`(storefront)`. A header, a footer and a floating WhatsApp button around a login
form are three ways to leave.

The layout is a split: brand and artwork on the left, form on the right. Both
routes **share** it, so moving between them swaps only the right-hand panel —
the artwork does not reload and nothing reflows. They stay separate URLs, so the
back button and a pasted link both behave.

The turn between them is a **CSS keyframe** (`.card-turn` in `globals.css`),
reached through `template.tsx`, which remounts on navigation within the group.
It was first written as a `motion` component and that was wrong: an entrance
animating from `opacity: 0` leaves the form **invisible until the bundle
hydrates**, and a login screen that needs JavaScript to become visible is a login
screen that fails closed. It was caught by screenshotting the page and finding
an empty panel. The same reasoning is already recorded in the README — entrance
animations are CSS so a failed bundle cannot blank the page — and this is the
second time that rule has earned its keep.
