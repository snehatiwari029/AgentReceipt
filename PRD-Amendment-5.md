# AgentReceipt PRD Amendment 5 (26 Oct 2026): conversational /chat

Supersedes Amendment 3, decision 2 ("session and grant written when the customer taps Looks right"). Requested by Sneha.

## Changes
1. The "Your order rules" form card and its Looks right / Change buttons are removed.
2. Muse's first reply is one sentence restating only what the customer said, then the option cards, then (only if the customer has not already named a payment) "Pick one, and tell me which payment to charge." Unmentioned rules are never mentioned, asked about or shown as "null".
3. The customer's reply that picks a product and names PayPal is the confirmation. Nothing is written to the database before it. At that moment the function writes, in order: Verified agent detected (simulated), Session started, Intent captured, Intent hash recorded, Grant captured, then the proposal and checkout action, then Order received.
4. The grant schema and storage are unchanged. Unspecified rules are null (no check).
5. Rules travel between phone and function with each message (the phone echoes them back) and are re-validated by the function.
6. Option cards still show no total and no formal terms (the hero trap is unchanged).

## Consequences to be aware of
- The grant is now sealed from the rules gathered during the chat, at order time. There is no explicit "yes, these are my rules" step; the order message is the customer's authorization.
- Product views the agent makes while browsing are no longer written as `view` actions, because no grant exists until the order. Only the checkout action is recorded.
- If payment is anything other than PayPal, Muse tells the customer and nothing is written.
- Whether Muse picks expedited shipping (the $509.95 hero) is still decided by the model from the store data; see the open question about the expedited fee being visible in the product listing.
