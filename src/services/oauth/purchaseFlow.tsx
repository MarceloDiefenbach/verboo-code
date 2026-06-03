import React, { useCallback, useEffect, useState } from 'react'

import { Select } from '../../components/CustomSelect/select.js'
import { Spinner } from '../../components/Spinner.js'
import { Box, render, Text } from '../../ink.js'
import { openBrowser } from '../../utils/browser.js'
import { fetchVerbooModels } from '../api/verbooModels.js'
import {
  createCheckoutSession,
  type CheckoutResult,
} from '../api/verbooCheckout.js'
import {
  clearMarketplaceCache,
  fetchMarketplaceGroups,
  type MarketplaceGroup,
} from '../api/verbooMarketplace.js'

const POLL_INTERVAL_MS = 3_000
const POLL_TIMEOUT_MS = 5 * 60 * 1_000

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

function formatInterval(interval: string): string {
  return interval === 'year' ? '/ano' : '/mes'
}

function getModelNames(group: MarketplaceGroup): string {
  const names = new Set<string>()
  for (const inst of group.instances) {
    for (const m of inst.models) {
      names.add(m.modelName)
    }
  }
  return [...names].join(', ')
}

function getSlotsInfo(group: MarketplaceGroup): string {
  const current = group.memberCount ?? 0
  if (group.subscriberLimit != null) {
    const remaining = group.subscriberLimit - current
    if (remaining <= 0) return 'Grupo lotado'
    return `${current}/${group.subscriberLimit} assinantes`
  }
  return `${current} assinantes`
}

function getPlanPriceDescription(group: MarketplaceGroup): string {
  const price = formatPrice(group.priceCents, group.currency)
  const interval = formatInterval(group.billingInterval)
  const models = getModelNames(group)
  const slots = getSlotsInfo(group)
  let desc = `${price}${interval}`
  if (models) desc += ` · ${models}`
  desc += ` · ${slots}`
  if (group.trialDays && group.trialDays > 0) {
    desc += ` · ${group.trialDays} dias de trial`
  }
  return desc
}

type Step =
  | 'splash'
  | 'loading-plans'
  | 'plans'
  | 'checkout'
  | 'polling'
  | 'success'
  | 'error'

export function PurchaseFlowView({
  accessToken,
  onDone,
}: {
  accessToken: string
  onDone: (result: boolean) => void
}) {
  const [step, setStep] = useState<Step>('splash')
  const [plans, setPlans] = useState<MarketplaceGroup[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchPlans = useCallback(async () => {
    setStep('loading-plans')
    clearMarketplaceCache()
    const groups = await fetchMarketplaceGroups({ force: true })
    if (groups.length === 0) {
      setStep('splash')
    } else {
      setPlans(groups)
      setStep('plans')
    }
  }, [])

  const startPolling = useCallback(async () => {
    const startTime = Date.now()
    while (Date.now() - startTime < POLL_TIMEOUT_MS) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
      try {
        const models = await fetchVerbooModels(accessToken, { force: true })
        if (models.length > 0) {
          setStep('success')
          setTimeout(() => onDone(true), 1_500)
          return
        }
      } catch {
        // retry
      }
    }
    onDone(false)
  }, [accessToken, onDone])

  const handlePlanSelect = useCallback(
    async (group: MarketplaceGroup) => {
      setStep('checkout')
      try {
        const result = await createCheckoutSession(accessToken, group.id)
        if (result.mode === 'trial') {
          setStep('success')
          setTimeout(() => onDone(true), 1_500)
          return
        }
        await openBrowser(result.url)
        setStep('polling')
        void startPolling()
      } catch (e) {
        setErrorMsg((e as Error).message)
        setStep('error')
      }
    },
    [accessToken, onDone, startPolling],
  )

  switch (step) {
    case 'splash':
      return (
        <Box flexDirection="column" gap={1}>
          <Text>Nenhum modelo disponivel na sua conta.</Text>
          <Select
            options={[
              { label: 'Fechar', value: 'fechar' },
              { label: 'Ver Planos', value: 'planos' },
            ]}
            onChange={(v: string) => {
              if (v === 'fechar') onDone(false)
              else void fetchPlans()
            }}
          />
        </Box>
      )

    case 'loading-plans':
      return (
        <Box flexDirection="column" gap={1}>
          <Text>Buscando planos disponiveis...</Text>
          <Spinner />
        </Box>
      )

    case 'plans': {
      const options = plans.map((plan, idx) => ({
        label: `${idx + 1}. ${plan.name}`,
        value: plan,
        description: getPlanPriceDescription(plan),
      }))
      options.push({ label: 'Voltar', value: null, description: '' })
      return (
        <Box flexDirection="column" gap={1}>
          <Text bold>Planos disponiveis</Text>
          <Select
            options={options}
            onChange={(v: MarketplaceGroup | null) => {
              if (!v) {
                setStep('splash')
                return
              }
              void handlePlanSelect(v)
            }}
          />
        </Box>
      )
    }

    case 'checkout':
      return (
        <Box flexDirection="column" gap={1}>
          <Text>Abrindo checkout no navegador...</Text>
          <Spinner />
        </Box>
      )

    case 'polling':
      return (
        <Box flexDirection="column" gap={1}>
          <Text>Aguardando confirmacao do pagamento...</Text>
          <Spinner />
        </Box>
      )

    case 'success':
      return <Text>Pagamento confirmado! Modelos disponiveis.</Text>

    case 'error':
      return (
        <Box flexDirection="column" gap={1}>
          <Text color="red">Erro: {errorMsg}</Text>
          <Select
            options={[
              { label: 'Tentar novamente', value: 'retry' },
              { label: 'Fechar', value: 'fechar' },
            ]}
            onChange={(v: string) => {
              if (v === 'fechar') onDone(false)
              else void fetchPlans()
            }}
          />
        </Box>
      )
  }
}

export async function showNoModelsFlow(
  accessToken: string,
): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    let instance: { unmount: () => void } | null = null

    render(
      <PurchaseFlowView
        accessToken={accessToken}
        onDone={(ok: boolean) => {
          instance?.unmount()
          setTimeout(() => resolve(ok), 50)
        }}
      />,
    ).then(inst => {
      instance = inst
    })
  })
}
