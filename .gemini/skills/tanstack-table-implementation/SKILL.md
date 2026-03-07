---
name: tanstack-table-implementation
description: Standard patterns for the Admin Dashboard in Divemap, covering layout standards (wide containers) and data table implementations (TanStack vs. Ant Design). Use when creating or refactoring admin pages to ensure visual consistency.
---

# Admin UI & Table Implementation Guide

This skill outlines the standard patterns for implementing the Admin Dashboard in Divemap. It covers both layout standards and data table implementations using either `@tanstack/react-table` or `antd`.

## 1. Layout Standards (Desktop)

To ensure a consistent, professional, and high-density interface across the admin panel, all admin pages MUST follow these layout constraints:

### Main Container
- **Standard:** `max-w-[95vw] xl:max-w-[1600px] mx-auto p-4 sm:p-6`
- **Goal:** Maximize screen real estate on wide monitors while maintaining readable margins on smaller desktops.

### Header Section
- Use a consistent spacing (e.g., `mb-8`) between the header and the filters/table.
- Align breadcrumbs or "Back" buttons consistently.

---

## 2. Choosing the Right Table Library

| Feature | **TanStack Table (Headless)** | **Ant Design Table (Component)** |
| :--- | :--- | :--- |
| **Best For** | Highly custom layouts, complex cell logic, maximum control over DOM structure. | High-density data, quick implementation, built-in features (pagination, loading, sorting). |
| **Styling** | Requires manual Tailwind CSS classes for every element. | Comes with polished default styles (requires minimal override). |
| **Development Speed** | Slower (boilerplate required). | Faster (plug-and-play). |
| **Use Case Example** | `AdminDives.js` (Custom row actions, complex layouts). | `AdminAuditLogs.js` (High-density logs, simple list view). |

---

## 3. TanStack Table Pattern (Default)

Use this for most primary entities (Users, Dives, Centers) where we need custom Tailwind styling and full control.

### Architecture
1.  **Page Component** (`src/pages/AdminX.js`): Data fetching & state.
2.  **Table Component** (`src/components/tables/AdminXTable.js`): Render logic.

### Page Component Pattern
```javascript
const AdminUsers = () => {
  // 1. Standard State
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [sorting, setSorting] = useState([]); 
  
  // 2. Query
  const { data } = useQuery(['users', pagination], () => fetchUsers(pagination));

  // 3. Render
  return (
    <div className="max-w-[95vw] xl:max-w-[1600px] mx-auto p-4 sm:p-6">
      <AdminUsersTable 
        data={data?.items} 
        pagination={pagination} 
        onPaginationChange={setPagination} 
      />
    </div>
  );
};
```

**Layout Standard:** Always use `max-w-[95vw] xl:max-w-[1600px]` for the container to maximize screen real estate on large admin monitors.

---

## 4. Ant Design Table Pattern

Use this for log views, history tables, or secondary data views where dense information density and speed of implementation are priorities.

### Key Implementation Details

1.  **Responsive Container:**
    ```javascript
    <div className='max-w-[95vw] xl:max-w-[1600px] mx-auto p-4 sm:p-6'>
    ```
2.  **Horizontal Scrolling:**
    Always set `scroll={{ x: 'max-content' }}` to prevent column squashing.
    ```javascript
    <Table scroll={{ x: 'max-content' }} ... />
    ```
3.  **Visuals:**
    -   Use `Tag` for status/enums.
    -   Use `Tooltip` for long text fields (e.g., Error Details) to keep rows compact.
    -   Use `Avatar` for user identification.

### Example Code
```javascript
import { Table, Tag, Tooltip } from 'antd';

const columns = [
  {
    title: 'Status',
    dataIndex: 'status',
    render: status => <Tag color={status === 'success' ? 'green' : 'red'}>{status}</Tag>
  },
  {
    title: 'Details',
    dataIndex: 'details',
    render: text => (
      <Tooltip title={text}>
        <div className="truncate max-w-xs">{text}</div>
      </Tooltip>
    )
  }
];

return (
  <Table 
    columns={columns} 
    dataSource={data} 
    pagination={serverSidePaginationConfig} 
    loading={isLoading}
    scroll={{ x: 'max-content' }} 
  />
);
```

## Common Pitfalls (All Tables)

1.  **Row Clicks vs. Actions**:
    If the row is clickable, ensure Action Buttons (Edit/Delete) use `e.stopPropagation()`.
2.  **UTC Dates**:
    Always use `formatDate` helper or `new Date().toLocaleDateString()` to handle UTC conversion.
3.  **Empty States**:
    Both patterns must handle empty data gracefully (TanStack requires manual check; AntD has `locale={{ emptyText: ... }}`).
