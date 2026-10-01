import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { formatMoney, type MoneyFormat } from '../../../common/money/format';

export interface ReportData {
  period: {
    startDate: string;
    endDate: string;
    label: string;
  };
  user: {
    name: string;
    email: string;
  };
  summary: {
    totalIncomeCents: number;
    totalExpenseCents: number;
    savingsCents: number;
    savingsRate: string;
    transactionCount: number;
  };
  transactions: Array<{
    period: string;
    handoverDate: string;
    type: 'income' | 'expense';
    categoryName: string;
    accountName: string;
    amountCents: number;
    note: string | null;
  }>;
  /** Money moved between the user's own accounts; not income or spending. */
  transfers: Array<{
    period: string;
    handoverDate: string;
    fromAccount: string;
    toAccount: string;
    amountCents: number;
    note: string | null;
  }>;
  generatedAt: string;
  money: MoneyFormat;
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a1a',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 20,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    padding: 12,
  },
  summaryLabel: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: '8 10',
    borderRadius: 4,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    padding: '7 10',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  colPeriod: {
    width: '14%',
  },
  colHandover: {
    width: '12%',
  },
  colCategory: {
    width: '20%',
  },
  colNote: {
    width: '25%',
    color: '#6b7280',
  },
  colType: {
    width: '10%',
  },
  colRoute: {
    width: '45%',
    paddingRight: 8,
  },
  colAmount: {
    // Wide enough for code-prefixed amounts such as "-BDT 12,34,567.00".
    width: '19%',
    textAlign: 'right',
  },
  incomeText: {
    color: '#16a34a',
  },
  expenseText: {
    color: '#dc2626',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#9ca3af',
  },
});

export default function FinancialReportDocument({
  data,
}: {
  data: ReportData;
}) {
  return (
    <Document title={`Financial Report – ${data.period.label}`}>
      <Page size="A4" style={styles.page}>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.title}>Financial Report</Text>
          <Text style={styles.subtitle}>{data.period.label}</Text>
          <Text style={styles.subtitle}>
            Prepared for: {data.user.name} ({data.user.email})
          </Text>
        </View>

        {/* SUMMARY SECTION */}
        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.summaryGrid}>
          {/* Card 1: Total Income */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Income</Text>
            <Text style={[styles.summaryValue, styles.incomeText]}>
              {formatMoney(data.summary.totalIncomeCents, data.money, {
                forPdf: true,
              })}
            </Text>
          </View>
          {/* Card 2: Total Expenses */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Expenses</Text>
            <Text style={[styles.summaryValue, styles.expenseText]}>
              {formatMoney(data.summary.totalExpenseCents, data.money, {
                forPdf: true,
              })}
            </Text>
          </View>
          {/* Card 3: Net Savings */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Net Savings</Text>
            <Text
              style={[
                styles.summaryValue,
                data.summary.savingsCents >= 0
                  ? styles.incomeText
                  : styles.expenseText,
              ]}
            >
              {formatMoney(data.summary.savingsCents, data.money, {
                forPdf: true,
              })}
            </Text>
          </View>
          {/* Card 4: Savings Rate */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Savings Rate</Text>
            <Text style={styles.summaryValue}>{data.summary.savingsRate}%</Text>
          </View>
        </View>
        <Text style={{ fontSize: 9, color: '#6b7280', marginBottom: 4 }}>
          {data.summary.transactionCount} transactions in this period
        </Text>

        {/* TRANSACTIONS SECTION */}
        <Text style={styles.sectionTitle}>Transactions</Text>

        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={styles.colPeriod}>Period</Text>
          <Text style={styles.colHandover}>Handover</Text>
          <Text style={styles.colCategory}>Category</Text>
          <Text style={styles.colNote}>Account · Note</Text>
          <Text style={styles.colType}>Type</Text>
          <Text style={styles.colAmount}>Amount</Text>
        </View>

        {/* Table Rows */}
        {data.transactions.map((tx, index) => (
          <View
            key={index}
            style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
          >
            <Text style={styles.colPeriod}>{tx.period}</Text>
            <Text style={styles.colHandover}>{tx.handoverDate}</Text>
            <Text style={styles.colCategory}>{tx.categoryName}</Text>
            <Text style={styles.colNote}>
              {[tx.accountName, tx.note].filter(Boolean).join(' · ')}
            </Text>
            <Text
              style={[
                styles.colType,
                tx.type === 'income' ? styles.incomeText : styles.expenseText,
              ]}
            >
              {tx.type === 'income' ? 'Income' : 'Expense'}
            </Text>
            <Text
              style={[
                styles.colAmount,
                tx.type === 'income' ? styles.incomeText : styles.expenseText,
              ]}
            >
              {formatMoney(
                tx.type === 'expense' ? -tx.amountCents : tx.amountCents,
                data.money,
                { forPdf: true },
              )}
            </Text>
          </View>
        ))}

        {data.transfers.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Transfers</Text>
            <Text style={{ fontSize: 9, color: '#6b7280', marginBottom: 6 }}>
              Money moved between your own accounts — savings, investments and
              debt payments. Not counted as income or spending.
            </Text>
            <View style={styles.tableHeader}>
              <Text style={styles.colPeriod}>Period</Text>
              <Text style={styles.colHandover}>Handover</Text>
              <Text style={styles.colRoute}>From – To · Note</Text>
              <Text style={styles.colType}>Type</Text>
              <Text style={styles.colAmount}>Amount</Text>
            </View>
            {data.transfers.map((transfer, index) => (
              <View
                key={index}
                style={[
                  styles.tableRow,
                  index % 2 === 1 ? styles.tableRowAlt : {},
                ]}
              >
                <Text style={styles.colPeriod}>{transfer.period}</Text>
                <Text style={styles.colHandover}>{transfer.handoverDate}</Text>
                <Text style={styles.colRoute}>
                  {[
                    `${transfer.fromAccount} to ${transfer.toAccount}`,
                    transfer.note,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                <Text style={styles.colType}>Transfer</Text>
                <Text style={styles.colAmount}>
                  {formatMoney(transfer.amountCents, data.money, {
                    forPdf: true,
                  })}
                </Text>
              </View>
            ))}
          </>
        ) : null}

        {/* FOOTER — appears on every page */}
        <View style={styles.footer} fixed>
          <Text>Generated on {data.generatedAt}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
