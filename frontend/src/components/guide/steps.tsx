import type { ReactNode } from "react";
import type { Shot } from "@/components/guide/GuideShot";

export type GuideStep = {
  id: string;
  title: string;
  /** Muted continuation of the title. */
  aside: string;
  where: { label: string; href: string };
  minutes: number;
  intro: ReactNode;
  actions: ReactNode[];
  tip?: ReactNode;
  shots: Shot[];
};

/** A label exactly as it appears in the app: a button, tab or field. */
export function Ui({ children }: { children: ReactNode }) {
  return (
    <span className="whitespace-nowrap rounded-[5px] border border-line bg-surface-2 px-1.5 py-px text-[0.92em] text-foreground">
      {children}
    </span>
  );
}

const PAGE = { width: 2040, height: 1290 } as const;

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: "first-look",
    title: "Take a first look.",
    aside: "Find your way around before you add anything.",
    where: { label: "Overview", href: "/dashboard" },
    minutes: 1,
    intro: (
      <>
        After you sign up you land on <strong>Overview</strong>. Your account
        already comes with a <strong>Main account</strong>, an{" "}
        <strong>Emergency fund</strong> goal and a set of everyday categories
        such as Salary, Groceries and Rent, so you can start recording straight
        away.
      </>
    ),
    actions: [
      <>
        Use the top bar to move between <Ui>Overview</Ui> <Ui>Accounts</Ui>{" "}
        <Ui>Goals</Ui> <Ui>Transactions</Ui> <Ui>Plan</Ui> <Ui>Insights</Ui>{" "}
        <Ui>Reports</Ui> and <Ui>Settings</Ui>. On a phone, they sit behind the
        menu button.
      </>,
      <>
        The <Ui>+ Transactions</Ui> button in the top bar is always there, so
        recording an entry is one click from anywhere.
      </>,
      <>
        The sun / moon button switches between light and dark. Your avatar opens
        Settings, this Guide and Log out.
      </>,
      <>
        A banner asks five quick questions about you. Click <Ui>Answer now</Ui>,
        which is step 2.
      </>,
    ],
    tip: (
      <>
        Empty cards are normal on day one. They fill in as you add accounts and
        transactions.
      </>
    ),
    shots: [
      {
        name: "first-visit",
        alt: "Overview page for a brand-new account",
        caption:
          "A new account: the Overview with the five-questions banner and empty cards waiting for data.",
        path: "/dashboard",
        ...PAGE,
      },
    ],
  },
  {
    id: "profile",
    title: "Tell it about you.",
    aside: "Five answers make every target fit your life.",
    where: {
      label: "Settings → Financial profile",
      href: "/settings?tab=financial",
    },
    minutes: 2,
    intro: (
      <>
        The app sizes your emergency fund, checks your insurance and orders your
        next steps using a short financial profile. Set your currency and
        timezone before you enter amounts.
      </>
    ),
    actions: [
      <>
        Open <Ui>Settings</Ui> and pick <Ui>Financial profile</Ui>.
      </>,
      <>
        Answer <strong>How steady is your income?</strong> Choose{" "}
        <Ui>Steady — mostly salary</Ui> or{" "}
        <Ui>Irregular — freelance, commission, seasonal</Ui>. Irregular income
        gets a bigger cushion: 6–12 months of essential costs instead of 3–6.
      </>,
      <>
        Add how many people depend on your income, whether you have health and
        life insurance, and your employer retirement match.
      </>,
      <>
        Go to <Ui>Preferences</Ui> to choose your appearance,{" "}
        <strong>currency and number format</strong>, and{" "}
        <strong>timezone</strong>. Your summaries show months and days in that
        timezone.
      </>,
    ],
    tip: (
      <>
        Once you have a few months of income recorded, the app tells you whether
        your income actually looks steady.
      </>
    ),
    shots: [
      {
        name: "settings-financial",
        alt: "Financial profile settings",
        caption:
          "Settings → Financial profile. The counter at the top shows how many answers you have given.",
        path: "/settings?tab=financial",
        ...PAGE,
      },
      {
        name: "settings-preferences",
        alt: "Preferences settings with appearance, currency and timezone",
        caption: "Settings → Preferences: appearance, currency and timezone.",
        path: "/settings?tab=preferences",
        ...PAGE,
      },
    ],
  },
  {
    id: "accounts",
    title: "Add your accounts.",
    aside: "Everything you own and everything you owe.",
    where: { label: "Accounts", href: "/accounts" },
    minutes: 3,
    intro: (
      <>
        Accounts hold your money. Add each bank account, wallet, savings
        account, investment, card and loan, so that <strong>net worth</strong>{" "}
        (what you own minus what you owe) and{" "}
        <strong>Available to spend</strong> are real.
      </>
    ),
    actions: [
      <>
        Click <Ui>Add account</Ui>. Choose a kind under{" "}
        <strong>Money you own</strong> (Bank account, Cash, Mobile wallet,
        Savings, Investments, Retirement, Property, Other asset) or{" "}
        <strong>Money you owe</strong> (Credit card, Loan).
      </>,
      <>
        Give it a name and enter its <Ui>Current balance</Ui>. For a card or
        loan, enter the <Ui>Amount owed today</Ui>.
      </>,
      <>
        Tick <Ui>Available to spend</Ui> if you could use the money within a few
        days without a penalty. Tick <Ui>Use as the default account</Ui> on the
        account your income and spending usually go through.
      </>,
      <>
        For cards and loans, add the <Ui>Interest rate (APR)</Ui>,{" "}
        <Ui>Minimum monthly payment</Ui> and <Ui>Credit limit</Ui>. The debt
        payoff plan uses them. For investments, add what they are mostly
        invested in and the annual fee.
      </>,
      <>
        The starter <strong>Main account</strong> is yours to rename: click the
        pencil next to it.
      </>,
      <>
        Investments and property change in value without any transactions. Use
        the chart button on their row to <strong>update the value</strong>. Net
        worth always uses the latest value.
      </>,
    ],
    shots: [
      {
        name: "accounts",
        alt: "Accounts page with net worth and available to spend",
        caption:
          "Net worth at the top, then what you own and what you owe, each with a balance trend.",
        path: "/accounts",
        ...PAGE,
      },
      {
        name: "account-form",
        alt: "Add account form",
        caption:
          "The Add account form. The fields change with the kind you pick.",
        path: "/accounts",
        width: 810,
        height: 1137,
        kind: "dialog",
      },
    ],
  },
  {
    id: "transactions",
    title: "Record money in and out.",
    aside: "Income, expenses and transfers in one ledger.",
    where: { label: "Transactions", href: "/transactions" },
    minutes: 2,
    intro: (
      <>
        Each entry is an <strong>Expense</strong>, an <strong>Income</strong> or
        a <strong>Transfer</strong> between your own accounts. Transfers
        (saving, investing, paying off a card) are <em>not</em> counted as
        spending, which keeps your savings rate accurate.
      </>
    ),
    actions: [
      <>
        Click <Ui>+ Transactions</Ui> in the top bar, then{" "}
        <Ui>Add transaction</Ui>.
      </>,
      <>
        Pick <Ui>Expense</Ui>, <Ui>Income</Ui> or <Ui>Transfer</Ui> and enter
        the amount.
      </>,
      <>
        Choose a <Ui>Category</Ui> and the account it was <Ui>Paid from</Ui> or{" "}
        <Ui>Received in</Ui>. For a transfer, choose where the money goes.
      </>,
      <>
        Set <Ui>Transaction for</Ui>, the month the entry belongs to. If a
        salary paid on 28 September is meant for October, choose October.{" "}
        <Ui>Date received or paid</Ui> is only for your records.
      </>,
      <>
        Add an optional note and click <Ui>Add transaction</Ui>, or{" "}
        <Ui>Record transfer</Ui> for a transfer.
      </>,
      <>
        In the ledger, filter by <Ui>All</Ui> <Ui>Income</Ui> <Ui>Expenses</Ui>{" "}
        <Ui>Transfers</Ui>, by month, year, date range, account or category.
        Each row has buttons to edit, delete or{" "}
        <strong>make it recurring</strong>.
      </>,
    ],
    tip: (
      <>
        Paying off a credit card? Record it as a Transfer from your bank to the
        card, not as an expense. The purchases were already counted.
      </>
    ),
    shots: [
      {
        name: "transaction-form",
        alt: "Add transaction form",
        caption:
          "The Add transaction form: type, amount, category, account, and the month it counts toward.",
        path: "/transactions",
        width: 810,
        height: 1326,
        kind: "dialog",
      },
      {
        name: "transactions",
        alt: "Transactions ledger with filters",
        caption:
          "The ledger with filters at the top. Hover a row to edit, delete or make it recurring.",
        path: "/transactions",
        ...PAGE,
      },
    ],
  },
  {
    id: "recurring",
    title: "Automate the regulars.",
    aside: "Salary, bills and subscriptions record themselves.",
    where: {
      label: "Transactions → Recurring",
      href: "/transactions?tab=recurring",
    },
    minutes: 3,
    intro: (
      <>
        Anything that repeats can run on a schedule. When your salary records
        itself on payday, your goals get their share automatically, so you save
        without having to remember.
      </>
    ),
    actions: [
      <>
        On Transactions, switch to <Ui>Recurring</Ui> and click{" "}
        <Ui>New recurring</Ui>.
      </>,
      <>
        Start from a template: <Ui>Salary</Ui> <Ui>Bill</Ui>{" "}
        <Ui>Subscription</Ui> <Ui>Invest every payday</Ui> or{" "}
        <Ui>Pay down debt</Ui>. It fills in the type, category and frequency for
        you.
      </>,
      <>
        Choose how often it happens (every week up to every year) and the first
        date. Use <Ui>Counts toward</Ui> for rent paid on the 1st that is really
        for the previous month, or a salary paid early.
      </>,
      <>
        Under <strong>When it&rsquo;s due</strong>, pick{" "}
        <Ui>Record it automatically</Ui> for fixed amounts, or{" "}
        <Ui>Ask me to confirm</Ui> for bills that vary. Those wait under{" "}
        <strong>Due</strong> until you confirm or skip them.
      </>,
      <>
        Already recorded the first one? Use the <strong>Make recurring</strong>{" "}
        button on that row in the ledger.
      </>,
    ],
    tip: (
      <>
        Mark streaming and app plans as subscriptions. The Subscriptions card
        adds them up per year, which makes it easier to decide whether each one
        is worth it.
      </>
    ),
    shots: [
      {
        name: "recurring",
        alt: "Recurring transactions view",
        caption:
          "Recurring view: subscription total, then income, bills and transfers with their next date.",
        path: "/transactions?tab=recurring",
        ...PAGE,
      },
    ],
  },
  {
    id: "goals",
    title: "Give your money a job.",
    aside: "Set money aside before you can spend it.",
    where: { label: "Goals", href: "/goals" },
    minutes: 3,
    intro: (
      <>
        Goals live inside your accounts, so every amount set aside is real
        money. Your income is shared out from the top of the list down, and the
        emergency fund always comes first.
      </>
    ),
    actions: [
      <>
        Set up the <strong>Emergency fund</strong> first: click its pencil and
        choose the account to keep it in. A separate savings account makes the
        money harder to spend by accident. Months of essentials can stay on{" "}
        <Ui>Automatic (from your financial profile)</Ui>.
      </>,
      <>
        Click <Ui>New goal</Ui> and choose <Ui>Sinking fund</Ui> (a known cost
        with a date, such as insurance or a new laptop), <Ui>Long-term goal</Ui>{" "}
        (years away, such as a home deposit) or <Ui>Other</Ui>.
      </>,
      <>
        Enter the target amount and date. A sinking fund can be linked to a
        category, so expenses in that category can be paid straight from the
        fund, and it can repeat every year.
      </>,
      <>
        Under <Ui>How is it funded?</Ui>, choose <Ui>% of each income</Ui>,{" "}
        <Ui>Fixed each month</Ui> or <Ui>Only when I add money</Ui>.
      </>,
      <>
        Use the arrows to reorder goals, because higher goals are funded first.
        Use <Ui>Add money</Ui> and <Ui>Withdraw</Ui> to move money by hand. Each
        goal is tagged <strong>On track</strong>, <strong>Ahead</strong>,{" "}
        <strong>Behind</strong> or <strong>Done</strong>.
      </>,
    ],
    tip: (
      <>
        Available to spend is your liquid money minus everything set aside for
        goals. That is the number to check before you buy something.
      </>
    ),
    shots: [
      {
        name: "goals",
        alt: "Goals page with emergency fund progress",
        caption:
          "Available to spend, money set aside, and the emergency fund measured in months of essentials.",
        path: "/goals",
        ...PAGE,
      },
      {
        name: "goal-form",
        alt: "New goal form",
        caption:
          "The New goal form: kind, target, account and how it is funded.",
        path: "/goals",
        width: 810,
        height: 1389,
        kind: "dialog",
      },
    ],
  },
  {
    id: "plan",
    title: "Plan the month.",
    aside: "Pay yourself first, cover your needs, then enjoy the rest.",
    where: { label: "Plan", href: "/budgets" },
    minutes: 3,
    intro: (
      <>
        The plan follows a simple order: <strong>① Pay yourself first</strong>{" "}
        (your goals), <strong>② Needs</strong>, then <strong>③ Wants</strong>.
        Whatever is left shows as <strong>Left to assign</strong>.
      </>
    ),
    actions: [
      <>
        Enter <Ui>Expected income this month</Ui>, or click <Ui>Use it</Ui> to
        use your three-month average.
      </>,
      <>
        Choose a <Ui>Method</Ui>. <Ui>50/30/20</Ui> means needs up to 50%, wants
        up to 30% and at least 20% saved. <Ui>70/20/10</Ui>, <Ui>Zero-based</Ui>{" "}
        (every unit gets a job) and <Ui>Caps only</Ui> are also available.
      </>,
      <>
        Set a monthly cap for each category under Needs and Wants. The{" "}
        <strong>So far</strong> column shows what you have actually spent.
      </>,
      <>
        Overspent a category? Use <strong>Cover</strong> to move money over from
        another category instead of breaking the plan.
      </>,
      <>Use the month arrows to plan ahead or look back.</>,
    ],
    tip: (
      <>
        Whether a category counts as a need or a want is set in{" "}
        <Ui>Settings</Ui> → <Ui>Categories</Ui>. Needs also set the size of your
        emergency fund.
      </>
    ),
    shots: [
      {
        name: "plan",
        alt: "Monthly plan with expected income, method and waterfall",
        caption:
          "Expected income and method on the left, the plan in order on the right with targets for each part.",
        path: "/budgets",
        ...PAGE,
      },
    ],
  },
  {
    id: "overview",
    title: "Read your Overview.",
    aside: "Where your money stands, in one place.",
    where: { label: "Overview", href: "/dashboard" },
    minutes: 2,
    intro: (
      <>
        Once you have some data, Overview is the page to check every day or two.
      </>
    ),
    actions: [
      <>
        Switch between <Ui>Monthly</Ui> <Ui>Quarterly</Ui> <Ui>Yearly</Ui>, and
        step through periods with the arrows.
      </>,
      <>
        <strong>Available to spend</strong> sits at the top, with the amount set
        aside for goals beneath it. Next to it, the{" "}
        <strong>Savings rate</strong> gauge shows the share of income you kept.
      </>,
      <>
        <strong>Next best step</strong> gives you the single most useful thing
        to do now, with a button that takes you there. Beside it are{" "}
        <strong>Net worth</strong>, <strong>Runway</strong> (months you could
        live on what you have) and your <strong>Health score</strong>.
      </>,
      <>
        Further down: Income, Expenses and Net savings compared with last month,
        a six-month <strong>Cash flow</strong> chart,{" "}
        <strong>Where it went</strong> by category,{" "}
        <strong>Savings momentum</strong>, upcoming recurring entries and{" "}
        <strong>Worth a look</strong> for unusual spending.
      </>,
      <>
        Banners also appear here when something needs you, such as a monthly
        review that is due.
      </>,
    ],
    shots: [
      {
        name: "dashboard",
        alt: "Overview with available to spend and savings rate",
        caption:
          "The top of Overview: period switch, a review reminder, Available to spend and Savings rate.",
        path: "/dashboard",
        ...PAGE,
      },
      {
        name: "dashboard-charts",
        alt: "Overview insights row, summary tiles and cash flow chart",
        caption:
          "Further down: next best step, net worth, runway, health score, monthly tiles and cash flow.",
        path: "/dashboard",
        ...PAGE,
      },
    ],
  },
  {
    id: "insights",
    title: "Check your insights.",
    aside: "One score, one next step, and tools to plan the rest.",
    where: { label: "Insights", href: "/insights" },
    minutes: 3,
    intro: (
      <>Insights explains your numbers and helps you plan the bigger moves.</>
    ),
    actions: [
      <>
        <Ui>Health</Ui> scores your finances out of 100 from up to nine
        measures. <strong>What makes up the score</strong> shows each measure
        and its weight, and the net worth chart covers 1, 2 or 5 years.
      </>,
      <>
        <Ui>Debt</Ui> builds a payoff plan. Compare <Ui>Avalanche</Ui> (highest
        rate first, saves the most interest) with <Ui>Snowball</Ui> (smallest
        balance first, for quick wins), try an extra amount each month, then
        apply the plan.
      </>,
      <>
        <Ui>Independence</Ui> estimates your financial independence number and
        how many years it will take, based on your age, spending, return and
        withdrawal rate.
      </>,
      <>
        <Ui>Investments</Ui> shows your asset mix against a target, plus the
        fees you pay. <Ui>Income</Ui> breaks down your sources and how much is
        passive.
      </>,
    ],
    tip: (
      <>
        The Next best step button opens the right tab for you. If it says to pay
        extra on a card, it opens the Debt planner.
      </>
    ),
    shots: [
      {
        name: "insights",
        alt: "Insights health tab with score and next best step",
        caption:
          "Health tab: score, next best step, net worth, runway and three-month saving and investing rates.",
        path: "/insights",
        ...PAGE,
      },
      {
        name: "insights-debt",
        alt: "Debt payoff planner",
        caption: "Debt tab: payoff strategy, extra payment and payoff order.",
        path: "/insights?tab=debt",
        ...PAGE,
      },
      {
        name: "insights-fi",
        alt: "Financial independence calculator",
        caption: "Independence tab: your FI number and years to get there.",
        path: "/insights?tab=fi",
        ...PAGE,
      },
    ],
  },
  {
    id: "habits",
    title: "Build the habits.",
    aside: "Five minutes a month, and a pause before big buys.",
    where: { label: "Monthly review", href: "/review" },
    minutes: 5,
    intro: (
      <>
        Two habits keep you on track: a short <strong>monthly review</strong>{" "}
        and a <strong>cooling-off list</strong> for things you want but
        don&rsquo;t need yet.
      </>
    ),
    actions: [
      <>
        When a month ends, Overview shows a banner asking you to review it.
        Click <Ui>Start review</Ui>.
      </>,
      <>
        The review has five short steps: <Ui>1. The numbers</Ui>{" "}
        <Ui>2. Wins</Ui> <Ui>3. Leaks</Ui> <Ui>4. Worth it?</Ui>{" "}
        <Ui>5. One thing</Ui>. Rate your non-essential spending as{" "}
        <strong>Worth it</strong>, <strong>Meh</strong> or{" "}
        <strong>Not worth it</strong>, then choose one thing to change next
        month.
      </>,
      <>
        On Goals, scroll to the <strong>Cooling-off list</strong> and click{" "}
        <Ui>Add a want</Ui>. The item waits a set time before you can buy it.
        Most urges pass.
      </>,
      <>
        When the wait is over, either record the purchase, skip it, or put the
        money towards a goal instead.
      </>,
    ],
    tip: (
      <>
        Use <Ui>Turn on the rule</Ui> to choose the amount above which a
        purchase waits, and for how long.
      </>
    ),
    shots: [
      {
        name: "review",
        alt: "Monthly review, step one",
        caption:
          "Monthly review: the five steps, starting with how the month went.",
        path: "/review",
        ...PAGE,
      },
      {
        name: "cooling-off",
        alt: "Cooling-off list on the Goals page",
        caption: "The cooling-off list, with the time left for each want.",
        path: "/goals",
        width: 1848,
        height: 392,
        kind: "crop",
      },
    ],
  },
  {
    id: "reports",
    title: "Take your numbers with you.",
    aside: "Export any period as a spreadsheet or a PDF.",
    where: { label: "Reports", href: "/reports" },
    minutes: 1,
    intro: (
      <>
        Useful for taxes, a loan application or sharing with a partner or
        adviser.
      </>
    ),
    actions: [
      <>Choose the first and last month to include.</>,
      <>
        Pick <Ui>CSV</Ui> (spreadsheet-ready data) or <Ui>PDF</Ui> (formatted
        for sharing).
      </>,
      <>
        Check the preview, then download. Past downloads are listed under
        Download history on this device.
      </>,
    ],
    shots: [
      {
        name: "reports",
        alt: "Reports page with period, format and preview",
        caption: "Reports: period, format and a preview before you download.",
        path: "/reports",
        ...PAGE,
      },
    ],
  },
  {
    id: "categories",
    title: "Fit the categories to you.",
    aside: "The labels behind every number.",
    where: { label: "Settings → Categories", href: "/settings?tab=categories" },
    minutes: 2,
    intro: (
      <>
        The starter categories cover most needs. Adjust them so your reports
        describe how you actually spend.
      </>
    ),
    actions: [
      <>
        Open <Ui>Settings</Ui> → <Ui>Categories</Ui>. Income and expense
        categories are listed separately.
      </>,
      <>
        Create a category with a name, type, colour and icon, or edit an
        existing one.
      </>,
      <>
        Set <Ui>Need or want?</Ui> on expense categories. Needs set your
        emergency fund size and the 50/30/20 split.
      </>,
      <>
        The <Ui>Account</Ui> tab holds your low-balance alert. Change your
        password and turn on two-factor authentication under <Ui>Security</Ui>.
      </>,
    ],
    tip: (
      <>
        The built-in default categories can be edited but not deleted, so your
        reports always have a place to put entries.
      </>
    ),
    shots: [
      {
        name: "settings-categories",
        alt: "Category settings",
        caption:
          "Settings → Categories: income and expense categories, each with a colour and icon.",
        path: "/settings?tab=categories",
        ...PAGE,
      },
    ],
  },
];

export const GUIDE_RHYTHM: Array<{ when: string; what: ReactNode }> = [
  {
    when: "Every few days",
    what: (
      <>
        Record spending, or check that recurring entries posted. Glance at
        Available to spend.
      </>
    ),
  },
  {
    when: "On payday",
    what: (
      <>Confirm any bills marked Due and check your goals got their share.</>
    ),
  },
  {
    when: "Start of the month",
    what: <>Set expected income and caps on Plan.</>,
  },
  {
    when: "End of the month",
    what: <>Do the five-minute review and pick one thing to change.</>,
  },
  {
    when: "Every quarter",
    what: <>Update investment and property values, then export a report.</>,
  },
];
