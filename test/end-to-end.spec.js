/* global it, describe */

const chai = require('chai')
const fs = require('fs')
const path = require('path')
const merge = require('../index')

const FIXTURES_DIR = path.join(__dirname, 'fixtures')
const COV_RE = /^cov\.(.+)\.json$/
// These tests are skipped because the algorithm returns more general results
// We need a check for "tree embedding" for those.
const SKIPPED = new Set(['nested-if', 'partial-overlap', 'partial-overlap2'])

describe('end-to-end', () => {
  for (const fixture of getFixtures()) {
    const {input, expected} = readFixture(fixture)
    const test = () => {
      let actual = merge(...input)
      chai.assert.deepEqual(actual, expected)
    }

    if (SKIPPED.has(fixture)) {
      it.skip(fixture, test)
    } else {
      it(fixture, test)
    }
  }
})

function getFixtures () {
  return fs.readdirSync(FIXTURES_DIR)
    .filter((child) => fs.statSync(path.join(FIXTURES_DIR, child)).isDirectory())
}

function readFixture (name) {
  const dir = path.join(FIXTURES_DIR, name)

  const input = []
  let expected

  for (const child of fs.readdirSync(dir)) {
    const match = COV_RE.exec(child)
    if (match === null) {
      continue
    }
    const data = JSON.parse(fs.readFileSync(path.join(dir, child), {encoding: 'UTF-8'}))
    if (match[1] === 'all') {
      expected = data
    } else {
      input.push(data)
    }
  }

  if (input.length === 0 || expected === undefined) {
    throw new Error(`Invalid fixture: ${dir}`)
  }
  return {input, expected}
}
