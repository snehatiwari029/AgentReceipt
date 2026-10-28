// ALL the words on the public page live in this one file. Change a string here and the page changes. No code knowledge needed.
// Keep the quotes and commas as they are. Lines marked PLACEHOLDER are stand-in text waiting for your real wording.
// Rules for any new copy: no blockchain wording, no real-payment wording, never claim "nobody records intent"
// (Verifiable Intent, AP2, Visa TAP and others exist). Say what AgentReceipt does: a merchant-side check and record.

export type Door = { to: string; title: string; note: string }

export const content = {
  brand: 'AgentReceipt',

  nav: {
    links: [
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Products', href: '#products' },
      { label: 'FAQ', href: '#faq' },
      { label: 'Pilot', href: '#pilot' },
    ],
    loginLabel: 'Login for demo',
    loginTo: '/dashboard', // the merchant dashboard has its own one-tap demo sign-in
  },

  hero: {
    eyebrow: 'Your trust partner for agent shopping',
    // Headline = before + (emphasis, shown in green italic) + after. Use "\n" for a line break.
    headlineBefore: 'Trust layer for\n',
    headlineEmphasis: 'agentic',
    headlineAfter: '\nshopping',
    body: 'As your customers are changing from humans to agents, we help you in that transition with the tools you need to run your business successfully.',
    primaryCta: 'Login for demo',
    secondaryCta: 'See how it works',
    // The tilted sample receipt on the right. Values are examples only.
    card: {
      orderLabel: 'ORDER',
      orderNumber: '08.142',
      badge: 'Review required',
      grantTitle: 'Grant · customer authorized',
      grantRows: [
        { label: 'Order total', value: '$180.00 max', flag: false },
        { label: 'Delivery', value: 'Standard', flag: false },
        { label: 'Returns', value: '30 days', flag: false },
      ],
      actionTitle: 'Action · agent ordered',
      actionRows: [
        { label: 'Order total', value: '$212.40', flag: true },
        { label: 'Delivery', value: 'Expedited', flag: true },
      ],
      footnote: 'Mismatch facts · not a liability decision',
      sideNote: 'not a verdict.',
    },
  },

  gap: {
    eyebrow: 'The authorization gap',
    headline: 'You see an order placed by an agent, but not what the customer authorized it to do.',
    body: "As an agent orders on a customer's behalf, it can make mistakes — whether it misinterprets the customer's needs or misunderstands a listing built for human shoppers. Errors happen, and they shouldn't cost you a chargeback and a lost product.",
    pullQuote: 'A purchase should come with a record of what was actually authorized.',
    footLabel: '01 / What changes with agent shopping',
  },

  partner: {
    eyebrow: 'A practical trust partner',
    headline: 'The right facts.\nAt the right moment.',
    columns: [
      {
        tag: '01 — Before fulfillment',
        title: 'Catch it before you ship',
        body: "Agent orders are checked at order received, before fulfillment. If the order doesn't match what the customer authorized — budget, returns, delivery, size — it's flagged Review Required or Hold for Suspicion, and you hold shipment until you review it.",
      },
      {
        tag: '02 — If it disputes',
        title: 'Prove it if it disputes anyway',
        // Reworded from the original slide on purpose: no represent / concede language, no chargeback-fee claim.
        body: 'Every order gets a tamper-evident, hash-sealed record of what the customer authorized and what the agent did. If a dispute comes in, download the evidence pack in one click: grant, action, receipt and the line-by-line check.',
      },
      {
        tag: '03 — Fix & optimize listings',
        title: 'Fix & optimize listings',
        body: 'Helps prevent agents from misunderstanding your offerings or missing details by optimizing your listings for agents. It not only helps prevent erroneous orders, but can also help drive additional orders.',
      },
    ],
  },

  steps: {
    id: 'how-it-works',
    eyebrow: 'A clear record at every step',
    headlineLines: ['Grant.', 'Action.'],
    headlineEmphasis: 'Verdict.',
    body: 'Fields, not chat. A neutral checkpoint between an agent order and fulfillment.',
    items: [
      { num: '01', title: 'Grant', body: 'Customer authorizes, as fields, hash-sealed', icon: 'fingerprint' },
      { num: '02', title: 'Action', body: 'Agent orders, action recorded beside the grant', icon: 'package' },
      { num: '03', title: 'Verdict', body: 'Pass / Review Required / Hold for Suspicion, in real time, before fulfillment', icon: 'shield' },
    ],
  },

  // PLACEHOLDER section: no slide was provided for Products. Replace the wording when you have it.
  products: {
    id: 'products',
    eyebrow: 'Products',
    headline: 'What AgentReceipt gives your team.',
    intro: 'Three tools, one record. (Placeholder wording: replace with your product descriptions.)',
    items: [
      { title: 'Order check', body: 'Compares the customer’s grant, your formal terms and the agent’s action line by line, and returns Pass, Review Required or Hold for Suspicion before you ship.' },
      { title: 'Evidence pack', body: 'A downloadable record for a disputed order: grant, action, hash-chained receipt and the verdict table. No customer chat included.' },
      { title: 'Listing optimizer', body: 'Spots listing wording that agents misread, such as marketing text that differs from formal terms, and suggests a fix for you to approve.' },
    ],
    demoTitle: 'Try the demo',
    demoNote: 'A simulated store, shopper agent and merchant view. Made-up customers, no real payments.',
    doors: [
      { to: '/chat', title: 'Customer phone', note: 'Talk to Muse, the shopper agent.' },
      { to: '/shop', title: 'Northwind store', note: 'The demo snowboard and ski store.' },
      { to: '/dashboard', title: 'Merchant dashboard', note: 'The merchant view of agent orders.' },
    ] as Door[],
  },

  faq: {
    id: 'faq',
    eyebrow: 'The details matter',
    headline: 'Questions, answered.',
    body: 'How the trust layer fits your operation — and what it does not do.',
    items: [
      {
        q: 'Can agents make errors?',
        a: [
          'Yes. Agents misread marketing summaries for formal terms, treat an item price as the total, or miss shipping and return terms.',
          "Those errors become the merchant's chargebacks and returns — AgentReceipt catches them before fulfillment.",
        ],
      },
      {
        // PLACEHOLDER answer
        q: 'How does AgentReceipt fit into my existing order flow?',
        a: [
          'AgentReceipt checks an agent order at order received and returns a recommendation. Your order system holds or releases shipment and capture.',
          'Integration details are coming soon.',
        ],
      },
      {
        // PLACEHOLDER answer
        q: 'What data do you store about my customers?',
        a: [
          'AgentReceipt stores the authorization fields, the order record and the receipt for each agent order. It does not receive the customer chat.',
          'The full data policy is coming soon. The demo uses made-up customers only.',
        ],
      },
      {
        // PLACEHOLDER answer
        q: 'What are the products / features offered?',
        a: ['Order check before fulfillment, a dispute evidence pack, and a listing optimizer. See the Products section above.'],
      },
    ],
  },

  pilot: {
    id: 'pilot',
    eyebrow: 'Start a conversation',
    headline: 'Reach out for pilot',
    body: 'Pilot merchants get the trust layer on their store.',
    footLabel: 'Built for merchants adapting to agentic shopping',
    fields: {
      name: 'Name',
      email: 'Work email',
      company: 'Company / Store name',
      url: 'Store URL (optional)',
      urlPlaceholder: 'https://',
      interest: 'I want to',
      message: 'Message (optional)',
    },
    // PLACEHOLDER options
    interestOptions: ['Join a pilot', 'See a live walkthrough', 'Ask a question'],
    submit: 'Submit',
    sending: 'Sending…',
    success: 'Thanks. We have your request and will be in touch.',
    error: 'Sorry, that did not send. Please try again.',
    privacy: 'We use these details only to reply to your request.', // PLACEHOLDER: confirm wording
  },

  footer: {
    // PLACEHOLDER
    line: '© AgentReceipt. Demo build for the Meta Global AI Developer Hackathon.',
    note: 'Demo only: simulated store and simulated payments. Verified-agent status shown in the demo is simulated. AgentReceipt shows mismatch facts only; it does not decide liability.',
  },
}
