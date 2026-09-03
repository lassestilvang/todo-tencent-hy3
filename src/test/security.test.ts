import { hashPassword, verifyPassword } from '@/lib/share'
import { verifyWebhookSignature } from '@/lib/webhooks'
import { createHmac } from 'crypto'

describe('Security Tests', () => {
  describe('Password Hashing and Verification', () => {
    it('should hash passwords correctly', () => {
      const password = 'testPassword123'
      const hash = hashPassword(password)

      expect(hash).toBeDefined()
      expect(hash).not.toBe(password)
      expect(hash).toHaveLength(64) // SHA256 produces 64 hex chars
    })

    it('should verify correct password', () => {
      const password = 'correctPassword'
      const hash = hashPassword(password)

      expect(verifyPassword(password, hash)).toBe(true)
    })

    it('should reject incorrect password', () => {
      const password = 'correctPassword'
      const wrongPassword = 'wrongPassword'
      const hash = hashPassword(password)

      expect(verifyPassword(wrongPassword, hash)).toBe(false)
    })

    it('should return false for mismatched lengths', () => {
      const password = 'short'
      const wrongHash = 'a' // Different length
      expect(verifyPassword(password, wrongHash)).toBe(false)
    })

    it('should produce consistent hashes for same password', () => {
      const password = 'consistentPassword'
      const hash1 = hashPassword(password)
      const hash2 = hashPassword(password)

      expect(hash1).toBe(hash2)
    })
  })

  describe('Webhook Signature Verification', () => {
    it('should verify correct HMAC signature', () => {
      const payload = 'test-payload'
      const secret = 'test-secret'
      const signature = createHmac('sha256', secret).update(payload).digest('hex')

      expect(verifyWebhookSignature(payload, signature, secret)).toBe(true)
    })

    it('should reject incorrect signature', () => {
      const payload = 'test-payload'
      const secret = 'test-secret'
      const wrongSignature = 'invalid-signature'

      expect(verifyWebhookSignature(payload, wrongSignature, secret)).toBe(false)
    })

    it('should reject signature with wrong secret', () => {
      const payload = 'test-payload'
      const correctSecret = 'correct-secret'
      const wrongSecret = 'wrong-secret'

      const signature = createHmac('sha256', correctSecret).update(payload).digest('hex')
      expect(verifyWebhookSignature(payload, signature, wrongSecret)).toBe(false)
    })

    it('should handle tampered payload', () => {
      const originalPayload = 'original-payload'
      const tamperedPayload = 'tampered-payload'
      const secret = 'test-secret'

      const signature = createHmac('sha256', secret).update(originalPayload).digest('hex')
      expect(verifyWebhookSignature(tamperedPayload, signature, secret)).toBe(false)
    })
  })
})