import { addTransaction, checkRecurringTransactionExists, getLastCheckDate, getRecurringTransactions, setLastCheckDate } from '../database/database';

export async function processRecurringTransactions() {
  try {
    const lastCheck = await getLastCheckDate();
    const now = new Date();
    const recurringRules = await getRecurringTransactions();
    
    console.log(`Processing recurring transactions. Last check: ${lastCheck.toISOString()}`);
    console.log(`Found ${recurringRules.length} recurring rules`);
    
    for (const rule of recurringRules) {
      const ruleStartDate = new Date(rule.start_date);
      ruleStartDate.setDate(1);
      ruleStartDate.setHours(0, 0, 0, 0);
      
      const ruleEndDate = rule.end_date ? new Date(rule.end_date) : null;
      
      // Start from rule start date (ignore lastCheck to ensure we process from the beginning)
      let currentMonth = new Date(ruleStartDate);
      
      // Process each month up to current month
      while (currentMonth <= now) {
        // Check if this month is within the rule's active period
        const isAfterStart = currentMonth >= ruleStartDate;
        const isBeforeEnd = !ruleEndDate || currentMonth <= ruleEndDate;
        
        if (isAfterStart && isBeforeEnd) {
          // Create transaction for this month on the 1st
          const transactionDate = new Date(currentMonth);
          transactionDate.setDate(1);
          transactionDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
          
          // Format month-year for duplicate check
          const monthYear = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
          const descriptionWithTag = `${rule.description} (Recurring)`;
          
          // Check if transaction already exists for this month
          const exists = await checkRecurringTransactionExists(descriptionWithTag, monthYear);
          
          if (!exists) {
            console.log(`Creating recurring transaction: ${rule.description} for ${transactionDate.toISOString()}`);
            
            await addTransaction({
              type: rule.type,
              amount: rule.amount,
              category_id: rule.category_id,
              description: descriptionWithTag,
              created_at: transactionDate.toISOString()
            });
          } else {
            console.log(`Recurring transaction already exists: ${rule.description} for ${monthYear}`);
          }
        }
        
        // Move to next month
        currentMonth.setMonth(currentMonth.getMonth() + 1);
      }
    }
    
    await setLastCheckDate(now);
    console.log('Recurring transactions processed successfully');
  } catch (error) {
    console.error('Error processing recurring transactions:', error);
  }
}
