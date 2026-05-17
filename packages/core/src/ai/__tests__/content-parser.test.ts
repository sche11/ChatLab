import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { extractThinkingContent, stripToolCallTags } from '../content-parser'

describe('extractThinkingContent', () => {
  it('returns empty strings for empty input', () => {
    const result = extractThinkingContent('')
    assert.equal(result.thinking, '')
    assert.equal(result.cleanContent, '')
  })

  it('extracts <think> tags', () => {
    const input = '<think>reasoning here</think>Final answer.'
    const result = extractThinkingContent(input)
    assert.equal(result.thinking, 'reasoning here')
    assert.equal(result.cleanContent, 'Final answer.')
  })

  it('extracts multiple different thinking tags', () => {
    const input = '<thinking>step 1</thinking> middle <analysis>step 2</analysis> end'
    const result = extractThinkingContent(input)
    assert.equal(result.thinking, 'step 1\nstep 2')
    assert.equal(result.cleanContent, 'middle  end')
  })

  it('is case-insensitive', () => {
    const input = '<THINK>upper case</THINK>content'
    const result = extractThinkingContent(input)
    assert.equal(result.thinking, 'upper case')
    assert.equal(result.cleanContent, 'content')
  })

  it('handles multiline thinking content', () => {
    const input = '<reasoning>\nline1\nline2\n</reasoning>done'
    const result = extractThinkingContent(input)
    assert.equal(result.thinking, 'line1\nline2')
    assert.equal(result.cleanContent, 'done')
  })

  it('skips empty thinking tags', () => {
    const input = '<think>   </think>only content'
    const result = extractThinkingContent(input)
    assert.equal(result.thinking, '')
    assert.equal(result.cleanContent, 'only content')
  })

  it('returns original content when no thinking tags exist', () => {
    const input = 'just plain text'
    const result = extractThinkingContent(input)
    assert.equal(result.thinking, '')
    assert.equal(result.cleanContent, 'just plain text')
  })
})

describe('stripToolCallTags', () => {
  it('removes tool_call tags', () => {
    const input = 'before<tool_call>{"name":"search"}</tool_call>after'
    assert.equal(stripToolCallTags(input), 'beforeafter')
  })

  it('removes multiple tool_call tags', () => {
    const input = '<tool_call>a</tool_call> text <tool_call>b</tool_call>'
    assert.equal(stripToolCallTags(input), 'text')
  })

  it('handles multiline tool_call content', () => {
    const input = 'start\n<tool_call>\n{\n"name": "x"\n}\n</tool_call>\nend'
    assert.equal(stripToolCallTags(input), 'start\n\nend')
  })

  it('returns original text when no tool_call tags', () => {
    assert.equal(stripToolCallTags('no tags here'), 'no tags here')
  })

  it('is case-insensitive', () => {
    const input = '<TOOL_CALL>data</TOOL_CALL>rest'
    assert.equal(stripToolCallTags(input), 'rest')
  })
})
