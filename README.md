# Budget App

A modern, feature-rich personal finance management application built with React Native and Expo. Track your income and expenses, manage budgets, and gain insights into your spending habits with beautiful visualizations.

## 📱 Features

### Core Functionality
- **Transaction Management**: Add, view, and delete income and expense transactions
- **Recurring Transactions**: Set up monthly recurring income or expenses (runs on 1st of each month)
  - Toggle between normal and recurring modes in transaction creation
  - Set start and optional end dates for recurring transactions
  - Manage and delete existing recurring transactions
- **Category System**: Create custom categories and organize transactions
- **Real-time Balance**: Automatic calculation of current balance, income, and expenses
- **Period Filtering**: View transactions by month or year
- **Transaction History**: Complete history of all financial transactions

### Analytics & Insights
- **Statistics Dashboard**: Comprehensive overview of your financial health
- **Category Breakdown**: Visual breakdown of spending by category
- **Trend Analysis**: 
  - Weekly trends for the current month
  - Monthly trends for the entire year
- **Savings Rate**: Automatic calculation of your savings percentage
- **Transaction Count**: Track the number of transactions per period

### User Experience
- **Beautiful UI**: Modern design with Tailwind CSS (NativeWind)
- **Tab Navigation**: Easy access to all features through bottom tabs
- **Real-time Updates**: Automatic refresh when data changes
- **Responsive Design**: Optimized for both iOS and Android

## 🏗️ Tech Stack

- **Framework**: [React Native](https://reactnative.dev/) (v0.81.5)
- **Runtime**: [Expo](https://expo.dev/) (~54.0.27)
- **Navigation**: [Expo Router](https://expo.github.io/router/) (~6.0.17)
- **Database**: [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) (~16.0.10)
- **Styling**: [NativeWind](https://www.nativewind.dev/) (v4.2.1) - Tailwind CSS for React Native
- **Language**: TypeScript
- **Notifications**: Expo Notifications with Background Fetch support


## 📱 Screens Overview

### 🏠 Home
- Displays current month's balance prominently
- Shows income and expense totals
- Lists recent transactions with category information
- Quick access to full transaction history

### ➕ New Transaction
- Toggle between normal and recurring transaction modes
- Add income or expense transactions
- For recurring transactions:
  - Automatically runs on the 1st of each month
  - Set start month and optional end date
  - Description required
- Select from existing categories or create new ones
- Add optional descriptions (required for recurring)
- Long-press categories to delete them
- Instant validation and feedback

### 📊 Statistics
- Toggle between monthly and yearly views
- Visual category breakdown for income and expenses
- Trend charts showing financial patterns
- Key metrics: balance, transaction count, savings rate

### 📜 History
- Complete list of all transactions
- Search and filter capabilities
- Delete transactions with swipe or long-press
- Organized by date

### 🔁 Recurring Transactions
- View all active recurring transactions
- See transaction details: amount, category, dates
- Tap to delete recurring transactions
- Empty state guidance for new users

### ⚙️ Settings
- Manage recurring transactions
- Manage categories
- App preferences and configurations

## 🗄️ Database Schema

### Tables

**categories**
- `id`: INTEGER PRIMARY KEY
- `name`: TEXT NOT NULL

**transactions**
- `id`: INTEGER PRIMARY KEY
- `type`: TEXT ('income' | 'expense')
- `amount`: REAL
- `category_id`: INTEGER (Foreign Key)
- `description`: TEXT
- `created_at`: TEXT (ISO format)

**budgets**
- `id`: INTEGER PRIMARY KEY
- `category_id`: INTEGER (Foreign Key, UNIQUE)
- `balance`: REAL DEFAULT 0

**recurring_transactions**
- `id`: INTEGER PRIMARY KEY
- `type`: TEXT ('income' | 'expense')
- `amount`: REAL
- `category_id`: INTEGER (Foreign Key)
- `description`: TEXT
- `day_of_month`: INTEGER (always 1)
- `start_date`: TEXT (ISO format)
- `end_date`: TEXT (ISO format, optional)

**app_metadata**
- `key`: TEXT PRIMARY KEY
- `value`: TEXT

### Features
- Automated triggers for balance calculations
- Indexed queries for optimal performance
- Foreign key constraints for data integrity


### Code Style

This project uses:
- **ESLint**: Code linting with Expo configuration
- **TypeScript**: Static type checking
- **NativeWind**: Utility-first styling

## 📦 Key Dependencies

- **@expo/vector-icons**: Icon library
- **@react-navigation**: Navigation solution
- **expo-sqlite**: Local database storage
- **expo-notifications**: Push notifications
- **expo-background-fetch**: Background data fetching
- **react-native-reanimated**: Smooth animations
- **nativewind**: Tailwind CSS integration

## 🎨 UI/UX Highlights

- **Color Scheme**: Blue primary (#2563eb), with emerald for income and rose for expenses
- **Typography**: Clear hierarchy with bold headings and readable body text
- **Spacing**: Consistent padding and margins using Tailwind utilities
- **Feedback**: Visual indicators for all user actions
- **Accessibility**: Semantic HTML and ARIA labels where applicable


## 🚧 Future Enhancements

Potential features to add:
- Detailed monthly and yearly reports with deeper insights
- Data export (CSV, PDF)
- Cloud backup and sync
- Financial goal tracking
- Bill reminders
- Multiple recurring frequencies (weekly, bi-weekly, etc.)
- Dark mode