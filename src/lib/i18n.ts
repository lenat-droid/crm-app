'use client'

import { useState, useEffect, useCallback } from 'react'

export type Lang = 'zh' | 'en'

function getLangFromUrl(): Lang | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const urlLang = params.get('lang')
  if (urlLang === 'en' || urlLang === 'zh') return urlLang
  return null
}

// ── Quick Check-in translations ──
export const qc = {
  zh: {
    title: '每日速報',
    subtitle: '快速登記客戶溝通記錄與產品興趣程度',
    recordedBy: '登記人',
    todayDate: '今日日期',
    step1: '① 選擇客戶',
    searchPlaceholder: '搜尋客戶名稱…',
    noMatch: '無匹配客戶',
    step2: '② 溝通記錄',
    commPlaceholder: '記錄本次溝通内容…（如：已發送 SMT Demo、約了下週拜訪）',
    step3: '③ 更新產品興趣程度（可選）',
    step3Hint: '當前值已預填，修改下拉框即可更新',
    saveBtn: '保存記錄',
    saved: '記錄已保存！',
    savedDesc: '你可以繼續登記下一條記錄。',
    continueBtn: '繼續登記',
    productLabels: {
      smtStatus: 'SMT',
      psWebsiteStatus: 'PS官網',
      aiCamStatus: 'AI Cam',
      posStatus: 'POS',
      platformManagedStatus: '平台托管',
      omeStatus: 'OME',
      smartRobotStatus: '智能機器人',
    },
    interestLabels: {
      NOT_CONTACTED: '未接觸',
      NOT_INTERESTED: '無興趣',
      AWARE: '已了解',
      INTERESTED: '感興趣',
      HIGH_INTENT: '高意向',
      PURCHASED: '已購買',
    },
    interestOptions: ['NOT_CONTACTED', 'NOT_INTERESTED', 'AWARE', 'INTERESTED', 'HIGH_INTENT', 'PURCHASED'],
    tips: '提示：登記後可在 CRM 系統的「看板」中查看完整溝通歷史，在「產品潜力看板」中查看各產品的興趣程度統計。如需查看完整客戶資料，請訪問',
    customerMgmt: '客戶管理',
    backToDashboard: '返回儀表盤',
    viewKanban: '查看看板',
    fetchError: '獲取客戶資料失敗',
    selectFirst: '請先選擇客戶',
    saveSuccess: '的記錄已保存',
    saveFail: '保存失敗',
  },
  en: {
    title: 'Daily Check-in',
    subtitle: 'Quickly log customer communications and product interest levels',
    recordedBy: 'Recorded by',
    todayDate: "Today's Date",
    step1: '① Select Customer',
    searchPlaceholder: 'Search customer name…',
    noMatch: 'No matching customer',
    step2: '② Communication Record',
    commPlaceholder: "Record communication details… (e.g. Sent SMT demo, scheduled next week's visit)",
    step3: '③ Update Product Interest (optional)',
    step3Hint: 'Current values are pre-filled, modify the dropdown to update',
    saveBtn: 'Save Record',
    saved: 'Record Saved!',
    savedDesc: 'You can continue logging the next record.',
    continueBtn: 'Continue',
    productLabels: {
      smtStatus: 'SMT',
      psWebsiteStatus: 'PS Website',
      aiCamStatus: 'AI Cam',
      posStatus: 'POS',
      platformManagedStatus: 'Platform Managed',
      omeStatus: 'OME',
      smartRobotStatus: 'Smart Robot',
    },
    interestLabels: {
      NOT_CONTACTED: 'Not Contacted',
      NOT_INTERESTED: 'Not Interested',
      AWARE: 'Aware',
      INTERESTED: 'Interested',
      HIGH_INTENT: 'High Intent',
      PURCHASED: 'Purchased',
    },
    interestOptions: ['NOT_CONTACTED', 'NOT_INTERESTED', 'AWARE', 'INTERESTED', 'HIGH_INTENT', 'PURCHASED'],
    tips: 'After saving, view the full communication history in the Kanban board and product interest statistics in the Product Potential Dashboard. To view complete customer details, visit',
    customerMgmt: 'Customer Management',
    backToDashboard: 'Back to Dashboard',
    viewKanban: 'View Kanban',
    fetchError: 'Failed to fetch customer data',
    selectFirst: 'Please select a customer first',
    saveSuccess: "'s record has been saved",
    saveFail: 'Failed to save',
  },
}

// ── Visit records translations ──
export const vr = {
  zh: {
    title: '拜訪記錄',
    newVisit: '新建拜訪',
    customerName: '客戶名稱',
    visitDate: '拜訪日期',
    visitedBy: '拜訪人',
    outcome: '結果',
    notes: '備註',
    action: '操作',
    viewCustomer: '查看客戶',
    total: (n: number) => `共 ${n} 條`,
    newVisitTitle: '新建拜訪記錄',
    customer: '客戶',
    selectCustomer: '搜索並選擇客戶',
    visitResult: '拜訪結果',
    save: '創建記錄',
    cancel: '取消',
    saved: '拜訪記錄已創建',
    failed: '創建失敗',
    pleaseSelect: '請選擇客戶',
    // Visit outcome options
    outcomeOptions: [
      { label: '感興趣，需跟進', value: 'Interested, needs follow-up' },
      { label: '暫無興趣', value: 'Not interested for now' },
      { label: '直接拒絕', value: 'Rejected directly' },
      { label: '見到負責人', value: 'Met owner/manager' },
      { label: '未見到負責人', value: 'Did not meet owner/manager' },
    ],
    notesPlaceholder: '記錄拜訪詳情...',
  },
  en: {
    title: 'Visit Records',
    newVisit: 'New Visit',
    customerName: 'Customer Name',
    visitDate: 'Visit Date',
    visitedBy: 'Visited By',
    outcome: 'Outcome',
    notes: 'Notes',
    action: 'Action',
    viewCustomer: 'View Customer',
    total: (n: number) => `Total ${n}`,
    newVisitTitle: 'New Visit Record',
    customer: 'Customer',
    selectCustomer: 'Search & select customer',
    visitResult: 'Visit Result',
    save: 'Create Record',
    cancel: 'Cancel',
    saved: 'Visit record created',
    failed: 'Failed to create',
    pleaseSelect: 'Please select a customer',
    outcomeOptions: [
      { label: 'Interested, needs follow-up', value: 'Interested, needs follow-up' },
      { label: 'Not interested for now', value: 'Not interested for now' },
      { label: 'Rejected directly', value: 'Rejected directly' },
      { label: 'Met owner/manager', value: 'Met owner/manager' },
      { label: 'Did not meet owner/manager', value: 'Did not meet owner/manager' },
    ],
    notesPlaceholder: 'Record visit details...',
  },
}

// ── Language hook ──
export function useLanguage() {
  const [lang, setLangState] = useState<Lang>('zh')

  useEffect(() => {
    const urlLang = getLangFromUrl()
    if (urlLang) {
      setLangState(urlLang)
      localStorage.setItem('preferredLang', urlLang)
    } else {
      const stored = localStorage.getItem('preferredLang') as Lang | null
      if (stored === 'en' || stored === 'zh') {
        setLangState(stored)
      }
    }
  }, [])

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang)
    localStorage.setItem('preferredLang', newLang)
    const url = new URL(window.location.href)
    url.searchParams.set('lang', newLang)
    window.history.replaceState({}, '', url.toString())
  }, [])

  return { lang, setLang }
}
