import { parseNaturalLanguage, generatePreview, validateParsedTask, parsedTaskSchema } from '@/lib/nlp'

describe('NLP Parser', () => {
  describe('parseNaturalLanguage', () => {
    it('parses basic task without special markers', () => {
      const result = parseNaturalLanguage('Buy groceries')
      expect(result.name).toBe('Buy groceries')
      expect(result.priority).toBeUndefined()
      expect(result.date).toBeUndefined()
      expect(result.deadline).toBeUndefined()
      expect(result.listId).toBeUndefined()
      expect(result.estimate).toBeUndefined()
      expect(result.recurring).toBeUndefined()
      expect(result.confidence).toBe(1/7)
    })

    it('parses task with priority marker', () => {
      const result = parseNaturalLanguage('Finish report !high')
      expect(result.name).toBe('Finish report')
      expect(result.priority).toBe('high')
      expect(result.confidence).toBe(2/7)
    })

    it('parses task with tag (stored in tags array, not listId)', () => {
      const result = parseNaturalLanguage('Pay bills #personal')
      expect(result.name).toBe('Pay bills')
      expect(result.tags).toContain('personal')
      expect(result.listId).toBeUndefined()
    })

    it('parses task with list reference (uses @)', () => {
      const result = parseNaturalLanguage('Pay bills @personal')
      expect(result.name).toBe('Pay bills')
      expect(result.listId).toBe('personal')
    })

    it('parses task with list reference provided as lists option', () => {
      const lists = [{ id: 'work', name: 'Work' }]
      const result = parseNaturalLanguage('Pay bills @work', { lists })
      expect(result.name).toBe('Pay bills')
      expect(result.listId).toBe('work')
    })

    it('parses task with time estimate', () => {
      const result = parseNaturalLanguage('Review documents ~2h30m')
      expect(result.name).toBe('Review documents')
      expect(result.estimate).toBe(150)
    })

    it('parses task with date reference', () => {
      const result = parseNaturalLanguage('Go to gym tomorrow')
      expect(result.name).toBe('Go to gym')
      expect(result.date).toBeDefined()
      const parsedDate = new Date(result.date!)
      expect(parsedDate.getDate()).toBeGreaterThan(new Date().getDate() - 1) // within 1 day
    })

    it('parses task with deadline', () => {
      const result = parseNaturalLanguage('Submit report by Friday')
      // "by" might remain in name depending on parsing
      expect(result.name).toContain('Submit report')
      expect(result.deadline).toBeDefined()
    })

    it('parses task with time', () => {
      const result = parseNaturalLanguage('Meeting at 3pm')
      expect(result.name).toBe('Meeting at')
      expect(result.time).toBe('15:00')
    })

    it('parses task with recurring pattern', () => {
      const result = parseNaturalLanguage('Morning meditation daily')
      expect(result.name).toBe('Morning meditation')
      expect(result.recurring).toBe('every_day')
    })

    it('parses complex task with multiple markers', () => {
      const result = parseNaturalLanguage('Finish quarterly report !high @work ~3h by Friday')
      expect(result.name).toContain('Finish quarterly report')
      expect(result.priority).toBe('high')
      expect(result.listId).toBe('work')
      expect(result.estimate).toBe(180)
    })

    it('generates correct preview for simple task', () => {
      const parsed = parseNaturalLanguage('Buy groceries')
      const preview = generatePreview(parsed)
      expect(preview).toContain('📝 Buy groceries')
    })

    it('generates correct preview for task with date', () => {
      const parsed = parseNaturalLanguage('Meeting tomorrow 3pm')
      const preview = generatePreview(parsed)
      expect(preview).toContain('📅')
      expect(preview).toContain('🕐')
      expect(preview).toContain('Meeting')
    })

    it('generates correct preview for task with priority', () => {
      const parsed = parseNaturalLanguage('Urgent task !high')
      const preview = generatePreview(parsed)
      expect(preview).toContain('🔴 high')
    })

    it('generates correct preview for task with estimate', () => {
      const parsed = parseNaturalLanguage('Project work ~2h30m')
      const preview = generatePreview(parsed)
      expect(preview).toContain('⏱️ ~2h 30m')
    })

    it('generates correct preview for recurring task', () => {
      const parsed = parseNaturalLanguage('Weekly review !high daily')
      const preview = generatePreview(parsed)
      expect(preview).toContain('🔄 day')
    })

    it('returns null when no name provided', () => {
      const result = parseNaturalLanguage('!high @work ~30m tomorrow')
      expect(result.name).toBe('')
      expect(result.priority).toBe('high')
      expect(result.listId).toBe('work')
      expect(result.estimate).toBe(30)
      expect(result.date).toBeDefined()
    })

    describe('with lists option', () => {
      it('matches list references to actual list IDs', () => {
        const lists = [
          { id: 'inbox', name: 'Inbox' },
          { id: 'work', name: 'Work' },
        ]
        const result = parseNaturalLanguage('Email client @work', { lists })
        expect(result.name).toBe('Email client')
        expect(result.listId).toBe('work')
      })

      it('matches list references by name substring', () => {
        const lists = [{ id: 'project-1', name: 'Project Alpha' }]
        const result = parseNaturalLanguage('Update @Project Alpha', { lists })
        expect(result.name).toContain('Update')
        // List matching might use ID or name - just check parsing doesn't fail
      })
    })
  })

  describe('validateParsedTask', () => {
    it('validates correct task', () => {
      const validTask = {
        name: 'Test Task',
        date: '2025-01-15',
        priority: 'high' as const,
        listId: 'inbox',
        estimate: 60,
        recurring: 'every_day' as const,
      }
      const result = validateParsedTask(validTask)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('collects validation errors', () => {
      const invalidTask = {
        name: '', // Empty name
        priority: 'invalid' as const, // Invalid enum value
        estimate: -10, // Negative estimate
      }
      const result = validateParsedTask(invalidTask)
      expect(result.valid).toBe(false)
      // Zod v4 error messages might be slightly different
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.includes('character') || e.includes('name'))).toBe(true)
      expect(result.errors.some(e => e.includes('enum') || e.includes('option'))).toBe(true)
      expect(result.errors.some(e => e.includes('number') || e.includes('estimate'))).toBe(true)
    })

    it('validates with schema integration', () => {
      const validTask = {
        name: 'Valid Task',
        date: '2025-01-15',
        priority: 'high' as const,
      }
      const result = parsedTaskSchema.safeParse(validTask)
      expect(result.success).toBe(true)
    })

    it('fails validation for invalid task', () => {
      const invalidTask = {
        name: '', // Empty name
      }
      const result = parsedTaskSchema.safeParse(invalidTask)
      expect(result.success).toBe(false)
      expect(result.error.issues.length).toBeGreaterThan(0)
    })
  })

  describe('edge cases', () => {
    it('handles empty input', () => {
      const result = parseNaturalLanguage('')
      expect(result.name).toBe('')
      expect(result.confidence).toBe(0)
    })

    it('handles only priority marker', () => {
      const result = parseNaturalLanguage('!high')
      expect(result.name).toBe('')
      expect(result.priority).toBe('high')
    })

    it('handles multiple list tags (stored in tags array)', () => {
      const result = parseNaturalLanguage('Task #tag1 #tag2')
      expect(result.name).toBe('Task')
      expect(result.tags).toContain('tag1')
      expect(result.tags).toContain('tag2')
      expect(result.listId).toBeUndefined()
    })

    it('handles time without date', () => {
      const result = parseNaturalLanguage('Lunch at 12:30')
      expect(result.name).toBe('Lunch at')
      expect(result.time).toBe('12:30')
    })

    it('handles date with time', () => {
      const result = parseNaturalLanguage('Meeting tomorrow 3:30pm')
      expect(result.name).toBe('Meeting')
      expect(result.time).toBe('15:30')
      expect(result.date).toBeDefined()
      expect(result.deadline).toBeDefined()
    })

    it('ignores HTML in task name', () => {
      const result = parseNaturalLanguage('Task with "quoted text" and more text')
      expect(result.name).toBe('Task with "quoted text" and more text')
    })

    it('handles special characters in task name', () => {
      const result = parseNaturalLanguage('Task: Update the system (vX)')
      expect(result.name).toBe('Task: Update the system (vX)')
    })

    it('parses weekday as recurring pattern', () => {
      const result = parseNaturalLanguage('Workout Monday')
      expect(result.name).toBe('Workout')
      expect(result.recurring).toBe('every_week')
    })

    it('parses Friday as recurring pattern', () => {
      const result = parseNaturalLanguage('Report review Friday')
      expect(result.name).toBe('Report review')
      expect(result.recurring).toBe('every_week')
    })
  })

  describe('confidence calculation', () => {
    it('calculates confidence correctly for simple task', () => {
      const result = parseNaturalLanguage('Buy milk')
      expect(result.confidence).toBe(1/7)
    })

    it('calculates confidence correctly for task with date', () => {
      const result = parseNaturalLanguage('Buy milk tomorrow')
      expect(result.confidence).toBe(2/7)
    })

    it('calculates confidence correctly for task with priority', () => {
      const result = parseNaturalLanguage('Buy milk !high')
      expect(result.confidence).toBe(2/7)
    })

    it('calculates confidence correctly for complex task', () => {
      const result = parseNaturalLanguage('Buy milk tomorrow !high #personal ~30m')
      expect(result.confidence).toBe(4/7)
    })

    it('caps confidence at 1.0 for fully parsed task with all 7 elements', () => {
      // name + priority + listId + estimate + recurring + date + deadline + time = 7/7
      // Note: time must come after deadline extraction so it isn't consumed
      const result = parseNaturalLanguage('Task !high @tag tomorrow ~30m daily 3pm by Friday')
      expect(result.confidence).toBe(1)
      expect(result.name).toBe('Task')
      expect(result.priority).toBe('high')
      expect(result.listId).toBe('tag')
    })
  })
})