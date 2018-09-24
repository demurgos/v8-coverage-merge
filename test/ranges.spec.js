/* global it, describe */

const merge = require('../')
const chai = require('chai')
const path = require('path')
const fs = require('fs')

const RANGES_DATA = path.join(__dirname, 'ranges.data.txt')

describe('ranges', () => {
  for (const {name, inputs, expected, skip, only} of getTestCases()) {
    const test = () => {
      const actual = merge(...inputs)
      chai.assert.deepEqual(actual, expected)
    }
    if (skip) {
      it.skip(name, test)
    } else if (only) {
      it.only(name, test)
    } else {
      it(name, test)
    }
  }
})

function * getTestCases () {
  const dataStr = fs.readFileSync(RANGES_DATA, {encoding: 'UTF-8'})
  yield * parseAll(dataStr)
}

function * parseAll (dataStr) {
  let name, offsets, inputs, ranges
  init()

  for (const line of iterLines(dataStr)) {
    const trimmed = line.trim()
    if (trimmed === '') {
      continue
    }
    if (name === undefined) {
      name = trimmed
    } else if (offsets === undefined) {
      offsets = parseOffsets(line)
    } else if (trimmed === '+' || trimmed === '=') {
      sortRanges(ranges)
      inputs.push(ranges)
      ranges = []
    } else if (trimmed[0] === '[') {
      for (const range of parseRanges(line, offsets)) {
        ranges.push(range)
      }
    } else {
      yield finalize()
      name = trimmed
      offsets = undefined
    }
  }

  yield finalize()

  function init () {
    name = undefined
    offsets = undefined
    ranges = []
    inputs = []
  }

  function finalize () {
    const ONLY_TAG = 'only:'
    const SKIP_TAG = 'skip:'
    const only = name.startsWith(ONLY_TAG)
    if (only) {
      name = name.substring(ONLY_TAG.length).trim()
    }
    const skip = name.startsWith(SKIP_TAG)
    if (skip) {
      name = name.substring(SKIP_TAG.length).trim()
    }

    sortRanges(ranges)
    const result = {
      name,
      inputs: inputs.map(scriptFromRanges),
      expected: scriptFromRanges(ranges),
      only,
      skip
    }
    init()
    return result
  }
}

function * iterLines (str) {
  let prev = 0
  while (true) {
    let next = str.indexOf('\n', prev)
    if (next < 0) {
      yield str.substring(prev, str.length)
      break
    }
    next++ // Consume `\n`
    yield str.substring(prev, next)
    prev = next
  }
}

function parseOffsets (line) {
  const result = new Map()
  const regex = /\d+/gs
  while (true) {
    const match = regex.exec(line)
    if (match === null) {
      break
    }
    result.set(match.index, parseInt(match[0], 10))
  }
  return result
}

function parseRanges (line, offsets) {
  const result = []
  const regex = /\[(\d+)-*\)/gs
  while (true) {
    const match = regex.exec(line)
    if (match === null) {
      break
    }
    const startIdx = match.index
    const endIdx = startIdx + match[0].length
    const count = parseInt(match[1], 10)
    const startOffset = offsets.get(startIdx)
    const endOffset = offsets.get(endIdx)
    result.push({startOffset, endOffset, count})
  }
  return result
}

function sortRanges (ranges) {
  ranges.sort(compareRanges)
}

/**
 * Compares two ranges.
 *
 * The ranges are first ordered by ascending `startOffset` and then by
 * descending `endOffset`.
 */
function compareRanges (a, b) {
  if (a.startOffset !== b.startOffset) {
    return a.startOffset - b.startOffset
  } else {
    return b.endOffset - a.endOffset
  }
}

function scriptFromRanges (ranges) {
  return {
    scriptId: '1',
    url: '/test.js',
    functions: [
      {
        functionName: 'test',
        isBlockCoverage: true,
        ranges,
      }
    ]
  }
}
