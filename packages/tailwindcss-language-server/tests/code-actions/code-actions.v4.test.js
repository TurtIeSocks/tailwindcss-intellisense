import { test, expect } from 'vitest'
import * as fs from 'node:fs/promises'
import { withFixture } from '../common'

withFixture('v4/basic', (c) => {
  function testFixture(fixture) {
    test(fixture, async () => {
      fixture = await fs.readFile(`tests/code-actions/${fixture}.json`, 'utf8')

      let { code, expected, language = 'html' } = JSON.parse(fixture)

      let promise = new Promise((resolve) => {
        c.onNotification('textDocument/publishDiagnostics', ({ diagnostics }) => {
          resolve(diagnostics)
        })
      })

      let textDocument = await c.openDocument({ text: code, lang: language })
      let diagnostics = await promise

      let res = await c.sendRequest('textDocument/codeAction', {
        textDocument,
        context: {
          diagnostics,
        },
      })
      // console.log(JSON.stringify(res))

      expected = JSON.parse(JSON.stringify(expected).replaceAll('{{URI}}', textDocument.uri))

      expect(res).toEqual(expected)
    })
  }

  testFixture('conflict')
  // testFixture('invalid-theme')
  // testFixture('invalid-screen')

  test('canonical class suggestions include a fix-all action', async () => {
    let promise = new Promise((resolve) => {
      c.onNotification('textDocument/publishDiagnostics', ({ diagnostics }) => {
        resolve(diagnostics)
      })
    })

    let textDocument = await c.openDocument({
      text: '<div class="[@media_print]:flex [color:red]/50 mt-[16px]">',
      lang: 'html',
    })
    let diagnostics = await promise

    let res = await c.sendRequest('textDocument/codeAction', {
      textDocument,
      context: {
        diagnostics,
      },
    })

    expect(res).toEqual([
      {
        title: "Replace with 'print:flex'",
        kind: 'quickfix',
        diagnostics: [diagnostics[0]],
        edit: {
          changes: {
            [textDocument.uri]: [{ range: diagnostics[0].range, newText: 'print:flex' }],
          },
        },
      },
      {
        title: "Replace with 'text-[red]/50'",
        kind: 'quickfix',
        diagnostics: [diagnostics[1]],
        edit: {
          changes: {
            [textDocument.uri]: [{ range: diagnostics[1].range, newText: 'text-[red]/50' }],
          },
        },
      },
      {
        title: "Replace with 'mt-4'",
        kind: 'quickfix',
        diagnostics: [diagnostics[2]],
        edit: {
          changes: {
            [textDocument.uri]: [{ range: diagnostics[2].range, newText: 'mt-4' }],
          },
        },
      },
      {
        title: 'Fix all Tailwind CSS canonical class suggestions',
        kind: 'source.fixAll.tailwindcss',
        diagnostics,
        edit: {
          changes: {
            [textDocument.uri]: [
              { range: diagnostics[0].range, newText: 'print:flex' },
              { range: diagnostics[1].range, newText: 'text-[red]/50' },
              { range: diagnostics[2].range, newText: 'mt-4' },
            ],
          },
        },
      },
    ])
  })

  test('canonical class fix-all can be requested directly', async () => {
    let promise = new Promise((resolve) => {
      c.onNotification('textDocument/publishDiagnostics', ({ diagnostics }) => {
        resolve(diagnostics)
      })
    })

    let textDocument = await c.openDocument({
      text: '<div class="[@media_print]:flex [color:red]/50 mt-[16px]">',
      lang: 'html',
    })
    let diagnostics = await promise

    let res = await c.sendRequest('textDocument/codeAction', {
      textDocument,
      context: {
        diagnostics,
        only: ['source.fixAll'],
      },
    })

    expect(res).toEqual([
      {
        title: 'Fix all Tailwind CSS canonical class suggestions',
        kind: 'source.fixAll.tailwindcss',
        diagnostics,
        edit: {
          changes: {
            [textDocument.uri]: [
              { range: diagnostics[0].range, newText: 'print:flex' },
              { range: diagnostics[1].range, newText: 'text-[red]/50' },
              { range: diagnostics[2].range, newText: 'mt-4' },
            ],
          },
        },
      },
    ])
  })

  test('workspace canonical class fixes do not require an open document', async () => {
    await c.openDocument({
      text: '<div class="flex">',
      lang: 'html',
    })

    let uri = c.fixtureUri('v4/basic/unopened-workspace-file.html')
    let res = await c.sendRequest('@/tailwindCSS/fixAllCanonicalClasses', {
      textDocument: {
        uri,
        languageId: 'html',
        version: 1,
        text: '<div class="[@media_print]:flex [color:red]/50 mt-[16px]">',
      },
    })

    expect(res).toEqual({
      edits: [
        expect.objectContaining({ newText: 'print:flex' }),
        expect.objectContaining({ newText: 'text-[red]/50' }),
        expect.objectContaining({ newText: 'mt-4' }),
      ],
    })
  })
})
