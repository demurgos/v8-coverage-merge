/* global it, describe */

const merge = require('../index')

require('chai').should()

describe('v8-coverage-merge', () => {
  it('appends functions with different names', () => {
    const merged = merge(
      {
        scriptId: '70',
        url: '/Users/benjamincoe/oss/c8/test/fixtures/timeout.js',
        functions: [
          {
            functionName: 'bar',
            isBlockCoverage: true,
            ranges: [
              {
                startOffset: 30,
                endOffset: 221,
                count: 1
              }
            ]
          }
        ]
      },
      {
        scriptId: '71',
        url: '/Users/benjamincoe/oss/c8/test/fixtures/timeout.js',
        functions: [
          {
            functionName: 'foo',
            isBlockCoverage: true,
            ranges: [
              {
                startOffset: 230,
                endOffset: 400,
                count: 2
              }
            ]
          }
        ]
      }
    )

    merged.functions.length.should.equal(2)
  })

  it('merges non-overlapping ranges for functions with same name', () => {
    // 20   30   221  300  400  410
    // [3----------------------)
    //      [1--)
    // +
    // [3----------------------)
    //                [2--)
    // =
    // [6----------------------)
    //      [4--)     [5--)

    const merged = merge(
      {
        scriptId: '70',
        url: '/Users/benjamincoe/oss/c8/test/fixtures/timeout.js',
        functions: [
          {
            functionName: 'bar',
            isBlockCoverage: true,
            ranges: [
              {
                startOffset: 20,
                endOffset: 410,
                count: 3
              },
              {
                startOffset: 30,
                endOffset: 221,
                count: 1
              }
            ]
          }
        ]
      },
      {
        scriptId: '71',
        url: '/Users/benjamincoe/oss/c8/test/fixtures/timeout.js',
        functions: [
          {
            functionName: 'bar',
            isBlockCoverage: true,
            ranges: [
              {
                startOffset: 20,
                endOffset: 410,
                count: 3
              },
              {
                startOffset: 300,
                endOffset: 400,
                count: 2
              }
            ]
          }
        ]
      }
    )

    merged.functions.length.should.equal(1)
    merged.functions[0].ranges.length.should.equal(3)
  })

  it('merges partially enclosed sub-range: a.startOffset < b.startOffset', () => {
    // 10   20   30   150  221  410
    // [3----------------------)
    //           [1-------)
    // +
    // [3----------------------)
    //      [2-------)
    // =
    // [6----------------------)
    //      [5--)[3--)[4--)

    const merged = merge(
      {
        scriptId: '70',
        url: '/Users/benjamincoe/oss/c8/test/fixtures/timeout.js',
        functions: [
          {
            functionName: 'bar',
            isBlockCoverage: true,
            ranges: [
              {
                startOffset: 10,
                endOffset: 410,
                count: 3
              },
              {
                startOffset: 30,
                endOffset: 221,
                count: 1
              }
            ]
          }
        ]
      },
      {
        scriptId: '71',
        url: '/Users/benjamincoe/oss/c8/test/fixtures/timeout.js',
        functions: [
          {
            functionName: 'bar',
            isBlockCoverage: true,
            ranges: [
              {
                startOffset: 10,
                endOffset: 410,
                count: 3
              },
              {
                startOffset: 20,
                endOffset: 150,
                count: 2
              }
            ]
          }
        ]
      }
    )

    merged.functions.length.should.equal(1)
    merged.functions[0].ranges.length.should.equal(4)
  })

  it('merges partially enclosed sub-range: a.endOffset > b.endOffset', () => {
    // 10   30   60   221  300  410
    // [3----------------------)
    //      [1-------)
    // +
    // [3----------------------)
    //           [0-------)
    // =
    // [6----------------------)
    //      [4--)[1--)[3--)

    const merged = merge(
      {
        scriptId: '70',
        url: '/Users/benjamincoe/oss/c8/test/fixtures/timeout.js',
        functions: [
          {
            functionName: 'bar',
            isBlockCoverage: true,
            ranges: [
              {
                startOffset: 10,
                endOffset: 410,
                count: 3
              },
              {
                startOffset: 30,
                endOffset: 221,
                count: 1
              }
            ]
          }
        ]
      },
      {
        scriptId: '71',
        url: '/Users/benjamincoe/oss/c8/test/fixtures/timeout.js',
        functions: [
          {
            functionName: 'bar',
            isBlockCoverage: true,
            ranges: [
              {
                startOffset: 10,
                endOffset: 410,
                count: 3
              },
              {
                startOffset: 60,
                endOffset: 300,
                count: 0
              }
            ]
          }
        ]
      }
    )

    merged.functions.length.should.equal(1)
    merged.functions[0].ranges.length.should.equal(4)
  })

  it('merges fully enclosed sub-range: b encloses a', () => {
    // 10   30   70   150  221  410
    // [3----------------------)
    //      [1------------)
    // +
    // [3----------------------)
    //           [1--)
    // =
    // [6----------------------)
    //      [4------------)
    //           [2--)

    const merged = merge(
      {
        scriptId: '70',
        url: '/Users/benjamincoe/oss/c8/test/fixtures/timeout.js',
        functions: [
          {
            functionName: 'bar',
            isBlockCoverage: true,
            ranges: [
              {
                startOffset: 10,
                endOffset: 410,
                count: 3
              },
              {
                startOffset: 30,
                endOffset: 221,
                count: 1
              }
            ]
          }
        ]
      },
      {
        scriptId: '71',
        url: '/Users/benjamincoe/oss/c8/test/fixtures/timeout.js',
        functions: [
          {
            functionName: 'bar',
            isBlockCoverage: true,
            ranges: [
              {
                startOffset: 10,
                endOffset: 410,
                count: 3
              },
              {
                startOffset: 70,
                endOffset: 150,
                count: 1
              }
            ]
          }
        ]
      }
    )

    merged.functions.length.should.equal(1)
    merged.functions[0].ranges.length.should.equal(3)
  })

  it('merges fully enclosed sub-range: a encloses b', () => {
    // 10   30   221  300  410
    // [3-----------------)
    //      [1--)
    // +
    // [3-----------------)
    // [1------------)
    // =
    // [6-----------------)
    // [4------------)
    //      [2--)

    const merged = merge(
      {
        scriptId: '70',
        url: '/Users/benjamincoe/oss/c8/test/fixtures/timeout.js',
        functions: [
          {
            functionName: 'bar',
            isBlockCoverage: true,
            ranges: [
              {
                startOffset: 10,
                endOffset: 410,
                count: 3
              },
              {
                startOffset: 30,
                endOffset: 221,
                count: 1
              }
            ]
          }
        ]
      },
      {
        scriptId: '71',
        url: '/Users/benjamincoe/oss/c8/test/fixtures/timeout.js',
        functions: [
          {
            functionName: 'bar',
            isBlockCoverage: true,
            ranges: [
              {
                startOffset: 10,
                endOffset: 410,
                count: 3
              },
              {
                startOffset: 10,
                endOffset: 300,
                count: 1
              }
            ]
          }
        ]
      }
    )

    merged.functions.length.should.equal(1)
    merged.functions[0].ranges.length.should.equal(3)
  })

  it('merges equivalent blocks', () => {
    // 10   30   221  410
    // [3------------)
    //      [1--)
    // +
    // [3------------)
    //      [1--)
    // =
    // [6------------)
    //      [2--)

    const merged = merge(
      {
        scriptId: '70',
        url: '/Users/benjamincoe/oss/c8/test/fixtures/timeout.js',
        functions: [
          {
            functionName: 'bar',
            isBlockCoverage: true,
            ranges: [
              {
                startOffset: 10,
                endOffset: 410,
                count: 3
              },
              {
                startOffset: 30,
                endOffset: 221,
                count: 1
              }
            ]
          }
        ]
      },
      {
        scriptId: '71',
        url: '/Users/benjamincoe/oss/c8/test/fixtures/timeout.js',
        functions: [
          {
            functionName: 'bar',
            isBlockCoverage: true,
            ranges: [
              {
                startOffset: 10,
                endOffset: 410,
                count: 3
              },
              {
                startOffset: 30,
                endOffset: 221,
                count: 1
              }
            ]
          }
        ]
      }
    )

    merged.functions.length.should.equal(1)
    merged.functions[0].ranges.length.should.equal(2)
  })

  it('merges multiple block ranges', () => {
    // 5    10   30   60   70   100  105  200  290  300  310  410
    // [3----------------------------------------------------)
    //           [1-----------------)     [2-------)
    // +
    // [3----------------------------------------------------)
    //      [1-------)     [2--)               [0-------)
    // =
    // [6----------------------------------------------------)
    //      [4--)[2--)[4------------)     [5--)[2--)[3--)
    //                     [3--)

    const merged = merge(
      {
        scriptId: '70',
        url: '/Users/benjamincoe/oss/c8/test/fixtures/timeout.js',
        functions: [
          {
            functionName: 'bar',
            isBlockCoverage: true,
            ranges: [
              {
                startOffset: 5,
                endOffset: 410,
                count: 3
              },
              {
                startOffset: 30,
                endOffset: 105,
                count: 1
              },
              {
                startOffset: 200,
                endOffset: 300,
                count: 2
              }
            ]
          }
        ]
      },
      {
        scriptId: '71',
        url: '/Users/benjamincoe/oss/c8/test/fixtures/timeout.js',
        functions: [
          {
            functionName: 'bar',
            isBlockCoverage: true,
            ranges: [
              {
                startOffset: 5,
                endOffset: 410,
                count: 3
              },
              {
                startOffset: 10,
                endOffset: 60,
                count: 1
              },
              {
                startOffset: 70,
                endOffset: 100,
                count: 2
              },
              {
                startOffset: 290,
                endOffset: 310,
                count: 0
              }
            ]
          }
        ]
      }
    )

    merged.functions.length.should.equal(1)
    merged.functions[0].ranges.length.should.equal(8)
  })

  // Skipped until the tested behavior is clarified
  it.skip('discards function coverage if block exists: b is function', () => {
    const merged = merge(
      {
        scriptId: '70',
        url: '/Users/benjamincoe/oss/c8/test/fixtures/timeout.js',
        functions: [
          {
            functionName: 'bar',
            isBlockCoverage: true,
            ranges: [
              {
                startOffset: 10,
                endOffset: 410,
                count: 3
              },
              {
                startOffset: 30,
                endOffset: 221,
                count: 1
              }
            ]
          }
        ]
      },
      {
        scriptId: '71',
        url: '/Users/benjamincoe/oss/c8/test/fixtures/timeout.js',
        functions: [
          {
            functionName: 'bar',
            isBlockCoverage: false,
            ranges: [
              {
                startOffset: 10,
                endOffset: 410,
                count: 3
              },
              {
                startOffset: 300,
                endOffset: 400,
                count: 2
              }
            ]
          }
        ]
      }
    )

    merged.functions.length.should.equal(1)
    merged.functions[0].ranges.length.should.equal(1)
  })

  // Skipped until the tested behavior is clarified
  it.skip('discards function coverage if block exists: b is block', () => {
    const merged = merge(
      {
        scriptId: '70',
        url: '/Users/benjamincoe/oss/c8/test/fixtures/timeout.js',
        functions: [
          {
            functionName: 'bar',
            isBlockCoverage: false,
            ranges: [
              {
                startOffset: 10,
                endOffset: 410,
                count: 3
              },
              {
                startOffset: 30,
                endOffset: 221,
                count: 1
              }
            ]
          }
        ]
      },
      {
        scriptId: '71',
        url: '/Users/benjamincoe/oss/c8/test/fixtures/timeout.js',
        functions: [
          {
            functionName: 'bar',
            isBlockCoverage: true,
            ranges: [
              {
                startOffset: 10,
                endOffset: 410,
                count: 3
              },
              {
                startOffset: 300,
                endOffset: 400,
                count: 2
              }
            ]
          }
        ]
      }
    )

    merged.functions.length.should.equal(1)
    merged.functions[0].ranges.length.should.equal(1)
  })
})
