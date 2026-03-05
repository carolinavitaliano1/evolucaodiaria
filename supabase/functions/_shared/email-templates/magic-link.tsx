/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu link de acesso — Evolução Diária</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={logoText}>📖 Evolução Diária</Text>
        </Section>
        <Heading style={h1}>Seu link de acesso</Heading>
        <Text style={text}>
          Clique no botão abaixo para entrar no <strong>Evolução Diária</strong>. Este link expira em breve.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Entrar no sistema
        </Button>
        <Text style={footer}>
          Se você não solicitou este link, pode ignorar este email com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { maxWidth: '480px', margin: '0 auto', padding: '32px 28px' }
const header = { marginBottom: '28px', paddingBottom: '20px', borderBottom: '1px solid #ede9f7' }
const logoText = { fontSize: '20px', fontWeight: 'bold' as const, color: 'hsl(252, 56%, 57%)', margin: '0' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(240, 10%, 15%)', margin: '0 0 16px' }
const text = { fontSize: '15px', color: 'hsl(240, 5%, 45%)', lineHeight: '1.6', margin: '0 0 28px' }
const button = {
  backgroundColor: 'hsl(252, 56%, 57%)',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '8px',
  padding: '14px 24px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0', lineHeight: '1.5' }
