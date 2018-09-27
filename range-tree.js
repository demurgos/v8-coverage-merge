class RangeTree {
  constructor (start, end, count, children) {
    this.start = start
    this.end = end
    this.count = count
    this.children = children
  }

  // Shallow
  copy () {
    return new RangeTree(this.start, this.end, this.count, this.children)
  }

  normalize () {
    const children = []
    let curEnd
    let head
    const tail = []
    for (const child of this.children) {
      if (head === undefined) {
        head = child
      } else if (child.count === head.count && child.start === curEnd) {
        tail.push(child)
      } else {
        endChain()
        head = child
      }
      curEnd = child.end
    }
    if (head !== undefined) {
      endChain()
    }

    if (children.length === 1) {
      const child = children[0]
      if (child.start === this.start && child.end === this.end) {
        this.count = child.count
        this.children = child.children
        return
      }
    }

    this.children = children

    function endChain () {
      if (tail.length !== 0) {
        head.end = tail[tail.length - 1].end
        for (const tailTree of tail) {
          for (const subChild of tailTree.children) {
            head.children.push(subChild)
          }
        }
        tail.length = 0
      }
      head.normalize()
      children.push(head)
    }
  }

  /**
   * @precondition `tree.start < value && value < tree.end`
   * @return RangeTree Right part
   */
  split (value) {
    let leftEnd = this.children.length
    let mid

    // TODO(perf): Binary search (check overhead)
    for (let i = 0; i < this.children.length; i++) {
      const child = this.children[i]
      if (child.start < value && value < child.end) {
        mid = child.split(value)
        leftEnd = i + 1
        break
      } else if (child.start >= value) {
        leftEnd = i
        break
      }
    }

    const rightLen = this.children.length - leftEnd
    const rightChildren = this.children.splice(leftEnd, rightLen)
    if (mid !== undefined) {
      rightChildren.unshift(mid)
    }
    const result = new RangeTree(value, this.end, this.count, rightChildren)
    this.end = value
    return result
  }

  toRanges () {
    const ranges = []
    const stack = [this]
    while (stack.length > 0) {
      const cur = stack.pop()
      ranges.push({startOffset: cur.start, endOffset: cur.end, count: cur.count})
      for (let i = cur.children.length - 1; i >= 0; i--) {
        stack.push(cur.children[i])
      }
    }
    return ranges
  }

  addCount (n) {
    const stack = [this]
    while (stack.length > 0) {
      const cur = stack.pop()
      cur.count += n
      for (let i = cur.children.length - 1; i >= 0; i--) {
        stack.push(cur.children[i])
      }
    }
  }

  toAsciiArt () {
    const eventSet = new Set()
    const layers = []
    let nextLayer = [this]
    while (nextLayer.length > 0) {
      const layer = nextLayer
      layers.push(layer)
      nextLayer = []
      for (const node of layer) {
        eventSet.add(node.start)
        eventSet.add(node.end)
        for (const child of node.children) {
          nextLayer.push(child)
        }
      }
    }
    const events = [...eventSet]
    events.sort((a, b) => a - b)
    let eventDigits = 1
    for (const event of events) {
      eventDigits = Math.max(eventDigits, event.toString(10).length)
    }
    const colWidth = eventDigits + 3
    const eventToCol = new Map()
    const headerLine = []
    for (let i = 0; i < events.length; i++) {
      eventToCol.set(events[i], i * colWidth)
      headerLine.push(events[i].toString(10).padEnd(colWidth, ' '))
    }
    const lines = [headerLine.join('')]
    for (const layer of layers) {
      const line = []
      let curIdx = 0
      for (const {start, end, count} of layer) {
        const startIdx = eventToCol.get(start)
        const endIdx = eventToCol.get(end)
        if (startIdx > curIdx) {
          line.push(' '.repeat((startIdx - curIdx)))
        }
        let rangeStart = `[${count}`
        const rangeLen = endIdx - startIdx
        if (rangeLen > (rangeStart.length + 1)) {
          rangeStart = rangeStart.padEnd(rangeLen - 1, '-')
        }
        line.push(`${rangeStart})`)
        curIdx = endIdx
      }
      lines.push(line.join(''))
    }
    lines.push('')

    return lines.join('\n')
  }

  _toAsciiArt (colMap) {
    const layers = []
    let nextLayer = [this]
    while (nextLayer.length > 0) {
      const layer = nextLayer
      layers.push(layer)
      nextLayer = []
      for (const node of layer) {
        for (const child of node.children) {
          nextLayer.push(child)
        }
      }
    }
    const lines = []
    for (const layer of layers) {
      const line = []
      let curIdx = 0
      for (const {start, end, count} of layer) {
        const startIdx = colMap.get(start)
        const endIdx = colMap.get(end)
        if (startIdx > curIdx) {
          line.push(' '.repeat((startIdx - curIdx)))
        }
        let rangeStart = `[${count}`
        const rangeLen = endIdx - startIdx
        if (rangeLen > (rangeStart.length + 1)) {
          rangeStart = rangeStart.padEnd(rangeLen - 1, '-')
        }
        line.push(`${rangeStart})`)
        curIdx = endIdx
      }
      lines.push(line.join(''))
    }

    return lines.join('\n')
  }

  static toAsciiForest (trees) {
    const eventSet = new Set()
    for (const tree of trees) {
      const stack = [tree]
      while (stack.length > 0) {
        const cur = stack.pop()
        eventSet.add(cur.start)
        eventSet.add(cur.end)
        for (let i = cur.children.length - 1; i >= 0; i--) {
          stack.push(cur.children[i])
        }
      }
    }
    const events = [...eventSet]
    events.sort((a, b) => a - b)
    let eventDigits = 1
    for (const event of events) {
      eventDigits = Math.max(eventDigits, event.toString(10).length)
    }
    const colWidth = eventDigits + 3
    const colMap = new Map()
    for (let i = 0; i < events.length; i++) {
      colMap.set(events[i], i * colWidth)
    }
    const blocks = []
    blocks.push(_offsetsToAscii(colMap))
    for (const tree of trees) {
      blocks.push(tree._toAsciiArt(colMap))
    }
    return blocks.join('\n')
  }

  /**
   * @precodition `ranges` are well-formed and pre-order sorted
   */
  static fromRanges (ranges) {
    const first = ranges[0]
    const root = new RangeTree(first.startOffset, first.endOffset, first.count, [])
    const stack = [root]
    for (let i = 1; i < ranges.length; i++) {
      const range = ranges[i]
      const node = new RangeTree(range.startOffset, range.endOffset, range.count, [])
      let top
      // The loop condition is only there for safety, it should always be true.
      while (stack.length > 0) {
        top = stack[stack.length - 1]
        if (range.startOffset >= top.end) {
          stack.pop()
          top = stack[stack.length - 1]
        } else {
          break
        }
      }
      if (top.start === node.start) {
        // throw new Error('Fail')
      }
      top.children.push(node)
      stack.push(node)
    }
    return root
  }
}

function _offsetsToAscii (colMap) {
  const line = []
  let curIdx = 0
  for (const [offset, index] of colMap) {
    if (index > curIdx) {
      line.push(' '.repeat(index - curIdx))
      curIdx = index
    }
    const str = offset.toString(10)
    line.push(str)
    curIdx += str.length
  }
  return line.join('')
}

module.exports = {RangeTree}
