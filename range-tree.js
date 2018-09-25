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
      } else {
        if (child.count === head.count && child.start === curEnd) {
          tail.push(child)
        } else {
          endChain()
          head = child
        }
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
      top.children.push(node)
      stack.push(node)
    }
    return root
  }
}

module.exports = {RangeTree}
