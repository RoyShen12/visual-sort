function standardNormalDistribution() {
  const numberPool = []
  return function () {
    if (numberPool.length > 0) {
      return numberPool.pop()
    }
    else {
      const u = Math.random(), v = Math.random()
      const p = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
      const q = Math.sqrt(-2 * Math.log(u)) * Math.sin(2 * Math.PI * v)
      numberPool.push(q)
      return p
    }
  }()
}

function NormalDistribution(off, con) {
  const standard = standardNormalDistribution()
  return standard * con + off
}

const fmt = new Intl.NumberFormat().format

/**
 * @type {CanvasRenderingContext2D}
 */
let ctx = null

let __w

const dpi = window.devicePixelRatio
const [height, width] = [Math.round(innerHeight * .8 / 100) * 100, Math.round(innerWidth / 100) * 100]
const [logicHeight, logicWidth] = [height * dpi, width * dpi]

const okColor = 'rgba(103, 194, 58, 1)'
const nomalColor = 'rgba(42, 62, 52, 1)'

const app = new Vue({
  el: '#app',
  data: {
    showCanvas: false,

    sortTypes: [
      'quick',
      'bubble',
      'bubble v2',
      'heap',
      'merge',
      'insert',
      'select'
    ],
    usingSort: 'quick',

    fps: 60,

    length: 400,

    steps: 0,

    barOrPoint: true
  },
  computed: {
    rendInterval() {
      if (this.fps > 500) return 0
      return 1000 / this.fps
    },
    humanSteps() {
      return fmt(this.steps)
    }
  },
  methods: {
    startSort() {
      this.steps = 0
      /**
       * @type {HTMLCanvasElement}
       */
      const canvasEle = this.$refs.cvs

      canvasEle.style.width = width + 'px'
      canvasEle.style.height = height + 'px'
      canvasEle.setAttribute('width', logicWidth)
      canvasEle.setAttribute('height', logicHeight)

      ctx = canvasEle.getContext('2d')
      if (dpi > 1) ctx.scale(dpi, dpi)

      ctx.fillStyle = nomalColor

      this.showCanvas = true

      const data = new Array(this.length).fill(1).map(() => _.random(0, height, false))
      // const data = new Array(this.length).fill(1).map(() => NormalDistribution(0, height / 2))

      __w = data.length < width ? Math.round(width / data.length) : width / data.length

      console.log(data)

      this.drawData(data)

      const cb = async (justStepOnSwap) => {
        if (!justStepOnSwap) this.drawData(data)
        this.steps++
        return new Promise(r => setTimeout(() => r(), justStepOnSwap ? 0 : this.rendInterval))
      }
      if (this.usingSort === 'quick') QuickSort(data, cb)
      else if (this.usingSort === 'bubble') BubbleSort(data, cb)
      else if (this.usingSort === 'bubble v2') BubbleSortV2(data, cb)
      else if (this.usingSort === 'heap') HeapSort(data, cb)
      else if (this.usingSort === 'merge') MergeSort(data, cb)
      else if (this.usingSort === 'insert') InsertionSort(data, cb)
      else if (this.usingSort === 'select') SelectionSort(data, cb)
    },
    drawData(data) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

      for (let i = 0; i < data.length; i++) {
        const __h = data[i]

        if (data[i + 1] !== undefined && data[i + 1] >= data[i]) {
          ctx.fillStyle = okColor
        }
        else {
          ctx.fillStyle = nomalColor
        }

        this.barOrPoint ?
          ctx.fillRect(i * __w, height - __h, __w, __h) :
          ctx.fillRect(i * __w, height - __h, __w, __w)

        // if (i % 3 === 0) ctx.strokeText(data[i], i * __w, 30)
      }
    }
  },
  created() {},
  mounted() {},
  watch: {
    length(v) {}
  }
})

async function QuickSort(arr, callBack) {
  const left = 0, right = arr.length - 1
  const list = [[left, right]]
  while(list.length > 0) {
    const now = list.pop()
    if (now[0] >= now[1]) continue
    let i = now[0], j = now[1], flag = i
    while(i < j) {
      while(arr[j] >= arr[flag] && j > flag) {
        j --
        // await callBack(true)
      }
      if (i >= j) break
      while(arr[i] <= arr[flag] && i < j) {
        i++
        // await callBack(true)
      }
      var temp = arr[flag]
      arr[flag] = arr[j]
      arr[j] = arr[i]
      arr[i] = temp
      flag = i
      await callBack()
    }
    list.push([now[0], flag - 1])
    list.push([flag + 1, now[1]])
  }
}

async function BubbleSort(array, callBack) {
  let len = array.length
  for (let i = 0; i < len; i++) {
    for (let j = 0; j < len-i-1; j++) {
      if (array[j]> array[j+1]) {
        [array[j], array[j+1]] = [array[j+1], array[j]]
        await callBack()
      }          
    }  
  } 
}

async function BubbleSortV2(array, callBack) {
  let swapped;
  for (let i = 0; i < array.length; i++) {
    swapped = true
    for (let j = 0; j < array.length - i - 1; j++) {
      if (array[j] > array[j+1]) {
        [array[j], array[j+1]] = [array[j+1], array[j]]
        await callBack()
        swapped = false
      }
    }
    if (swapped) {
      break
    }
  }
}

async function HeapSort(arr, callBack) {
  let heapSize = arr.length
  await buildHeap(arr, callBack)
  while(heapSize > 1) { 
    const temp = arr[0]
    arr[0] = arr[heapSize-1]
    arr[heapSize-1] = temp
    await callBack()
    heapSize--
    if (heapSize>1) {
      await heapify(arr, heapSize, 0, callBack)
    }
  }
}

async function buildHeap(arr, callBack) {
  const heapSize = arr.length
  const firstHeapifyIndex = Math.floor(heapSize / 2 - 1)
  for (let i = firstHeapifyIndex; i >= 0; i--) {
    await heapify(arr, heapSize, i, callBack)
  }
}

async function heapify(arr, heapSize, i, callBack) {
  const leftIndex = i * 2 + 1
  const rightIndex = i * 2 + 2
  let biggestValueIndex = i
  if (leftIndex < heapSize && arr[leftIndex] > arr[biggestValueIndex]) {
    biggestValueIndex = leftIndex
  }
  if (rightIndex < heapSize && arr[rightIndex] > arr[biggestValueIndex]) {
    biggestValueIndex = rightIndex
  }
  if (biggestValueIndex !== i) {
    const temp = arr[i]
    arr[i] = arr[biggestValueIndex]
    arr[biggestValueIndex] = temp
    await callBack()
    await heapify(arr, heapSize, biggestValueIndex, callBack)
  }
}

async function MergeSort(arr, callBack) {
  const len = arr.length
  let left_s, left_e, right_s, right_e
  let left_list = null
  for (let i = 1; i < len; i *= 2) {
    let next = 0
    for (left_s = 0; left_s < len; left_s = right_e) {
      next = left_s
      left_e = right_s = left_s + i
      right_e = right_s + i
      if(right_e > len) {
        right_e = len
      }
      left_list = arr.slice(left_s,left_e)
      let left_index = 0
      const left_len = left_list.length
      while(left_index < left_len) {
        if (right_s >= right_e || left_list[left_index] <= arr[right_s]) {
          arr[next++] = left_list[left_index++]
          await callBack()
        }
        else {
          arr[next++] = arr[right_s++]
          await callBack()
        }
      }
    }
  }
}

async function InsertionSort(array, callBack) {
  let len = array.length
  for (let i = 0; i < len; i++) {
      let temp = array[i]
      let j = i - 1
      while (j >= 0 && array[j] > temp) {
          array[j+1] = array [j]
          await callBack()
          j--
      }
      array[j+1] = temp
      await callBack()
  }
}

async function SelectionSort(array, callBack) {
  let len = array.length
  for (let i = 0; i < len - 1; i++) {
    let  minIndex = i
      for (let j = i + 1; j < len; j++) {
        if (array[j] < array[minIndex]) {
          minIndex = j
          // await callBack(true)
        }
      }
     if (minIndex != i) {
        [array[minIndex], array[i]] = [array[i], array[minIndex]]
        await callBack()
     }
  }
}
