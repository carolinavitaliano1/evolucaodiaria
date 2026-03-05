/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código de verificação — Evolução Diária</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={logoText}>📖 Evolução Diária</Text>
        </Section>
        <Heading style={h1}>Código de verificação</Heading>
        <Text style={text}>Use o código abaixo para confirmar sua identidade:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Este código expira em breve. Se você não solicitou isto, ignore este email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { maxWidth: '480px', margin: '0 auto', padding: '32px 28px' }
const header = { marginBottom: '28px', paddingBottom: '20px', borderBottom: '1px solid #ede9f7' }
const logoText = { fontSize: '20px', fontWeight: 'bold' as const, color: 'hsl(252, 56%, 57%)', margin: '0' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(240, 10%, 15%)', margin: '0 0 16px' }
const text = { fontSize: '15px', color: 'hsl(240, 5%, 45%)', lineHeight: '1.6', margin: '0 0 20px' }
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: 'hsl(252, 56%, 57%)',
  letterSpacing: '6px',
  margin: '0 0 30px',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0', lineHeight: '1.5' }
