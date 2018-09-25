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

  // normalize() {
  //   for (const child of this.children) {
  //     child.normalize()
  //   }
  // }

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
