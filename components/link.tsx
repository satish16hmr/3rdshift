// @ts-nocheck
'use client'

import React, { forwardRef } from 'react'
import NextLink from 'next/link'
import * as Headless from '@headlessui/react'

export const Link = forwardRef(function Link(props, ref) {
  return (
    <Headless.DataInteractive>
      <NextLink {...props} ref={ref} />
    </Headless.DataInteractive>
  )
})
