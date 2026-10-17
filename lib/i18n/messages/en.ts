export type MessageTree = {
  common: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    search: string;
    loading: string;
    collapse: string;
    expand: string;
    close: string;
    more: string;
    hide: string;
    unhide: string;
    language: string;
    signOut: string;
    myProfile: string;
    systemSettings: string;
    notifications: string;
    markAllRead: string;
    viewAll: string;
    noNotifications: string;
    searchVehicles: string;
    searchOrJump: string;
    workspace: string;
    quickActions: string;
    skipToMain: string;
  };
  nav: {
    overview: string;
    salesCrm: string;
    inventoryAuctions: string;
    finance: string;
    operations: string;
    administration: string;
    dashboard: string;
    customers: string;
    inquiries: string;
    quotations: string;
    agentVerification: string;
    myVerificationCode: string;
    bulkUpload: string;
    cars: string;
    machinery: string;
    parts: string;
    stockPipeline: string;
    auction: string;
    auctionPurchases: string;
    invoices: string;
    auctionInvoices: string;
    remittances: string;
    remittanceInsights: string;
    commissions: string;
    accountsExpenses: string;
    agentLedger: string;
    officesShifts: string;
    tasksApprovals: string;
    notifications: string;
    reports: string;
    blogPosts: string;
    usersTeams: string;
    permissions: string;
    systemConfig: string;
    systemMonitor: string;
    globalConfiguration: string;
    auctionHouses: string;
    auditLogs: string;
  };
  mobile: {
    home: string;
    stock: string;
    tasks: string;
    more: string;
    new: string;
    newInquiry: string;
    newInvoice: string;
    newQuotation: string;
    reserveVehicle: string;
    addExpense: string;
    uploadStock: string;
    remittances: string;
    noQuickActions: string;
  };
};

const en: MessageTree = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    search: 'Search',
    loading: 'Loading…',
    collapse: 'Collapse',
    expand: 'Expand',
    close: 'Close',
    more: 'More',
    hide: 'Hide',
    unhide: 'Unhide',
    language: 'Language',
    signOut: 'Sign Out',
    myProfile: 'My profile',
    systemSettings: 'System Settings',
    notifications: 'Notifications',
    markAllRead: 'Mark all read',
    viewAll: 'View all notifications',
    noNotifications: 'No notifications yet',
    searchVehicles: 'Search vehicles…',
    searchOrJump: 'Search or jump to…',
    workspace: 'Workspace',
    quickActions: 'Quick actions',
    skipToMain: 'Skip to main content',
  },
  nav: {
    overview: 'Overview',
    salesCrm: 'Sales & CRM',
    inventoryAuctions: 'Inventory & Auctions',
    finance: 'Finance',
    operations: 'Operations',
    administration: 'Administration',
    dashboard: 'Dashboard',
    customers: 'Customers',
    inquiries: 'Inquiries',
    quotations: 'Quotations',
    agentVerification: 'Agent verification',
    myVerificationCode: 'My verification code',
    bulkUpload: 'Bulk upload',
    cars: 'Cars',
    machinery: 'Machinery',
    parts: 'Parts',
    stockPipeline: 'Stock pipeline',
    auction: 'Auction',
    auctionPurchases: 'Auction Purchases',
    invoices: 'Invoices',
    auctionInvoices: 'Auction invoices',
    remittances: 'Remittances / T/T',
    remittanceInsights: 'Remittance insights',
    commissions: 'Commissions',
    accountsExpenses: 'Accounts & Expenses',
    agentLedger: 'Agent ledger',
    officesShifts: 'Offices & shifts',
    tasksApprovals: 'Tasks & Approvals',
    notifications: 'Notifications',
    reports: 'Reports',
    blogPosts: 'Blog posts',
    usersTeams: 'Users & Teams',
    permissions: 'Permissions',
    systemConfig: 'System Config',
    systemMonitor: 'System monitor',
    globalConfiguration: 'Global Configuration',
    auctionHouses: 'Auction houses',
    auditLogs: 'Audit Logs',
  },
  mobile: {
    home: 'Home',
    stock: 'Stock',
    tasks: 'Tasks',
    more: 'More',
    new: 'New',
    newInquiry: 'New inquiry',
    newInvoice: 'New invoice',
    newQuotation: 'New quotation',
    reserveVehicle: 'Reserve vehicle',
    addExpense: 'Add expense',
    uploadStock: 'Upload stock',
    remittances: 'Remittances / T/T',
    noQuickActions: 'No quick actions available for your role.',
  },
};

export default en;
