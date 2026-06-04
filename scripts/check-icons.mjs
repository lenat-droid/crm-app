import * as icons from '@ant-design/icons';

const names = [
  'DashboardOutlined','TeamOutlined','KanbanOutlined','BarChartOutlined',
  'EnvironmentOutlined','FileTextOutlined','UserAddOutlined','SettingOutlined',
  'LogoutOutlined','MenuFoldOutlined','MenuUnfoldOutlined','UserOutlined',
  'EditOutlined','MailOutlined','LockOutlined','PlusOutlined','SearchOutlined',
  'SwapRightOutlined','UploadOutlined','InboxOutlined','CheckCircleOutlined',
  'RiseOutlined','ReloadOutlined'
];

for (const name of names) {
  const status = typeof icons[name] !== 'undefined' ? 'OK' : 'MISSING';
  console.log(`${name}: ${status}`);
}
