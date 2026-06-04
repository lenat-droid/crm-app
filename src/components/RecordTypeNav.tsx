'use client'

import React from 'react'
import { Segmented } from 'antd'
import { UserAddOutlined, CustomerServiceOutlined, EnvironmentOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'

export type RecordType = 'lead' | 'checkin' | 'visit'

interface RecordTypeNavProps {
  active: RecordType
}

const options = [
  {
    label: '👤 新建線索',
    value: 'lead' as RecordType,
    icon: <UserAddOutlined />,
  },
  {
    label: '📞 每日速报',
    value: 'checkin' as RecordType,
    icon: <CustomerServiceOutlined />,
  },
  {
    label: '📍 拜訪記錄',
    value: 'visit' as RecordType,
    icon: <EnvironmentOutlined />,
  },
]

const pathMap: Record<RecordType, string> = {
  lead: '/leads/new',
  checkin: '/quick-checkin',
  visit: '/visits/new',
}

export default function RecordTypeNav({ active }: RecordTypeNavProps) {
  const router = useRouter()

  const handleChange = (val: string | number) => {
    const target = val as RecordType
    if (target !== active) {
      router.push(pathMap[target])
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <Segmented
        value={active}
        onChange={handleChange}
        options={options}
        block
        size="large"
      />
    </div>
  )
}
