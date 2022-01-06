function standardNormalDistribution() {
  /**
   * @type {number[]}
   */
  const numberPool = []
  return (function () {
    if (numberPool.length > 0) {
      return numberPool.pop()
    } else {
      const u = Math.random(),
        v = Math.random()
      const p = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
      const q = Math.sqrt(-2 * Math.log(u)) * Math.sin(2 * Math.PI * v)
      numberPool.push(q)
      return p
    }
  })()
}

/**
 * @param {number} off
 * @param {number} con
 */
function NormalDistribution(off, con) {
  const standard = standardNormalDistribution()
  return standard * con + off
}

/**
 * @param {number[]} arr
 */
function isSorted(arr) {
  return arr.every((v, i) => i === arr.length - 1 || v < arr[i + 1])
}

/**
 * @param {number} min
 * @param {number} max
 */
function getRandomInt(min, max) {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min //含最大值，最小值
}

class WorkerFlow {
  static __id = 0

  constructor(fileName) {
    this.worker = new Worker(fileName)
    this.owned = false
    this.id = WorkerFlow.__id++
  }

  async onmessage() {
    return await new Promise(resolve => {
      this.worker.onmessage = e => resolve(e.data)
    })
  }

  /**
   * @param {Transferable} transferable
   * @returns {Promise<ArrayBuffer>}
   */
  async transferAndRetrieve(transferable) {
    // const len = transferable.byteLength
    // console.time(`Worker[${this.id}] payload: ${len} bytes`)
    this.worker.postMessage(transferable, [transferable])
    const res = await this.onmessage()
    this.owned = false
    // console.timeEnd(`Worker[${this.id}] payload: ${len} bytes`)
    // console.log(performance.now(), `Worker[${this.id}] released`)
    return res
  }
}

/**
 * @type {number}
 */
const worker_count = navigator.hardwareConcurrency || 8

/**
 * @type {WorkerFlow[]}
 */
const merge_workers = new Array(worker_count).fill(1).map(() => new WorkerFlow('merge_worker.js'))

/**
 * @param {WorkerFlow[]} workers
 */
async function pick_one_worker(workers) {
  let try_pick = workers.find(worker => !worker.owned)
  while (try_pick === undefined) {
    // console.log('-'.repeat(10) + ' No Worker Available ' + '-'.repeat(10))
    await new Promise(r => setTimeout(() => r(), 0))
    try_pick = workers.find(worker => !worker.owned)
  }
  try_pick.owned = true
  // console.log(performance.now(), `Worker[${try_pick.id}] picked`)
  return try_pick
}

/**
 * Debug show workers info
 * @param {WorkerFlow[]} workers
 */
function workerStatistic(workers) {
  const st = workers.reduce(
    (p, v) => {
      if (v.owned) p[0] = p[0] + 1
      else p[1] = p[1] + 1
      return p
    },
    [0, 0]
  )
  return `idle: ${st[1]}, busy: ${st[0]}`
}

// setInterval(() => {
//   if (merge_workers.find(worker => worker.owned)) console.log(workerStatistic(merge_workers))
// }, 4)

const fmt = new Intl.NumberFormat().format

/**
 * @type {CanvasRenderingContext2D}
 */
let ctx = null

/**
 * @type {number}
 */
let __w

const dpi = window.devicePixelRatio
const [height, width] = [Math.round((innerHeight * 0.8) / 100) * 100, Math.floor(innerWidth / 100) * 100]
const [logicHeight, logicWidth] = [height * dpi, width * dpi]

const okColor = 'rgba(103, 194, 58, 1)'
const normalColor = 'rgba(42, 62, 52, 1)'

let __steps = 0

const { createApp, ref, reactive, computed } = Vue

const app = createApp({
  setup() {
    const workerCount = ref(worker_count)
    const showCanvas = ref(false)
    const dataLengths = reactive([10, 50, 100, 200, 400, 800, 1200, 1600, 1900, 2000, 2500, 2700, 3400, 1e4, 1e5, 1e6, 1e7])
    const fpsRange = reactive([3, 10, 30, 60, 90, 144, 200, 250, 500, 'as fast as possible'])
    const sortTypes = reactive([
      ['quick', QuickSort],
      ['bubble', BubbleSort],
      ['bubble v2', BubbleSortV2],
      ['heap', HeapSort],
      ['merge', MergeSort],
      ['merge multi-thread', MergeSortWorker],
      ['insert', InsertionSort],
      ['select', SelectionSort],
      ['shell', ShellSort],
      ['monkey', MonkeySort],
    ])

    const usingSort = ref('quick')

    const fps = ref(60)

    const length = ref(400)

    const steps = ref(0)
    const isRunning = ref(false)
    const cancelToken = ref(false)

    const barOrPoint = ref(true)

    const rendInterval = computed(() => {
      if (fps.value > 500 || typeof fps.value === 'string') return 0
      return 1000 / fps.value
    })

    const humanSteps = computed(() => fmt(steps.value))

    const loadStep = _.throttle(() => {
      steps.value = __steps
    }, 100)

    const terminate = () => {
      cancelToken.value = true
      showCanvas.value = false
      __steps = 0
      loadStep()
    }

    const startSort = async () => {
      cancelToken.value = false
      isRunning.value = true

      __steps = 0

      loadStep()

      /**
       * @type {HTMLCanvasElement}
       */
      const canvasEle = document.getElementById('cvs')

      canvasEle.style.width = width + 'px'
      canvasEle.style.height = height + 'px'
      canvasEle.setAttribute('width', logicWidth)
      canvasEle.setAttribute('height', logicHeight)

      ctx = canvasEle.getContext('2d')
      if (dpi > 1) ctx.scale(dpi, dpi)

      ctx.fillStyle = normalColor

      showCanvas.value = true

      const data = new Uint16Array(new Array(length.value).fill(1).map(() => _.random(0, height, false)))
      // const data = new Array(length.value).fill(1).map(() => NormalDistribution(0, height / 2))

      __w = data.length < width ? Math.round(width / data.length) : width / data.length

      // console.log(data)

      drawData(data)

      // console.log(sortTypes)

      try {
        await sortTypes.find(st => st[0] === usingSort.value)[1](
          data,
          async () => {
            if (cancelToken.value) throw new Error('cancel token killed sorting !')

            drawData(data)
            __steps++
            loadStep()

            return new Promise(r => setTimeout(r, rendInterval.value))
          },
          count => {
            count === undefined ? __steps++ : (__steps += count)
            loadStep()
          }
        )
      } catch (_e) {
        console.error(_e)
      }

      isRunning.value = false
    }

    const drawData = data => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

      for (let i = 0; i < data.length; i++) {
        const __h = data[i]

        if (data[i - 1] !== undefined) {
          if (data[i - 1] <= data[i]) {
            ctx.fillStyle = okColor
          } else {
            ctx.fillStyle = normalColor
          }
        } else if (data[i] >= data[i + 1]) {
          ctx.fillStyle = okColor
        } else {
          ctx.fillStyle = normalColor
        }

        barOrPoint.value ? ctx.fillRect(i * __w, height - __h, __w, __h) : ctx.fillRect(i * __w, height - __h, __w, __w)

        // if (i % 3 === 0) ctx.strokeText(data[i], i * __w, 30)
      }
    }

    return {
      workerCount,
      showCanvas,
      dataLengths,
      fpsRange,
      sortTypes,
      usingSort,
      fps,
      length,
      steps,
      isRunning,
      cancelToken,
      barOrPoint,
      rendInterval,
      humanSteps,
      loadStep,
      terminate,
      startSort,
      drawData,
    }
  },
  methods: {
    next(arr, v) {
      let i = arr.indexOf(this[v])
      const len = arr.length
      this[v] = arr[i === len - 1 ? 0 : (i + 1)]
    }
  }
})

app.use(ElementPlus.ElRow)
app.use(ElementPlus.ElCol)
app.use(ElementPlus.ElOption)
app.use(ElementPlus.ElSelect)
app.use(ElementPlus.ElButton)
app.use(ElementPlus.ElSwitch)

app.mount('#app')

/// Sort Functions
/**
 * @typedef {(arr: Uint16Array, callBack: () => Promise<void>, hardCallBack: () => void) => Promise<void>} SortFunction
 */

/**
 * @type {SortFunction}
 */
async function QuickSort(arr, callBack, hardCallBack) {
  const left = 0,
    right = arr.length - 1
  const list = [[left, right]]

  while (list.length > 0) {
    const now = list.pop()

    hardCallBack()
    if (now[0] >= now[1]) continue

    let i = now[0],
      j = now[1],
      flag = i

    while (i < j) {
      while (arr[j] >= arr[flag] && j > flag) {
        j--
        hardCallBack()
      }

      hardCallBack()
      if (i >= j) break

      while (arr[i] <= arr[flag] && i < j) {
        i++
        hardCallBack()
      }

      const temp = arr[flag]
      arr[flag] = arr[j]
      arr[j] = arr[i]
      arr[i] = temp
      flag = i
      await callBack()
    }

    hardCallBack()
    list.push([now[0], flag - 1])
    list.push([flag + 1, now[1]])
  }
}

/**
 * @type {SortFunction}
 */
async function BubbleSort(array, callBack, hardCallBack) {
  let len = array.length
  for (let i = 0; i < len; i++) {
    for (let j = 0; j < len - i - 1; j++) {
      hardCallBack()
      if (array[j] > array[j + 1]) {
        ;[array[j], array[j + 1]] = [array[j + 1], array[j]]
        await callBack()
      }
    }
  }
}

/**
 * @type {SortFunction}
 */
async function BubbleSortV2(array, callBack, hardCallBack) {
  let swapped

  for (let i = 0; i < array.length; i++) {
    swapped = true
    for (let j = 0; j < array.length - i - 1; j++) {
      hardCallBack()
      if (array[j] > array[j + 1]) {
        ;[array[j], array[j + 1]] = [array[j + 1], array[j]]
        await callBack()
        swapped = false
      }
    }
    if (swapped) {
      break
    }
  }
}

/**
 * @type {SortFunction}
 */
async function HeapSort(arr, callBack, hardCallBack) {
  let heapSize = arr.length
  await buildHeap(arr, callBack, hardCallBack)

  while (heapSize > 1) {
    const temp = arr[0]
    arr[0] = arr[heapSize - 1]
    arr[heapSize - 1] = temp
    await callBack()
    heapSize--
    if (heapSize > 1) {
      await heapify(arr, heapSize, 0, callBack, hardCallBack)
    }
  }
}

/**
 * @type {SortFunction}
 */
async function buildHeap(arr, callBack, hardCallBack) {
  const heapSize = arr.length
  hardCallBack()
  const firstHeapifyIndex = Math.floor(heapSize / 2 - 1)
  for (let i = firstHeapifyIndex; i >= 0; i--) {
    await heapify(arr, heapSize, i, callBack, hardCallBack)
  }
}

async function heapify(arr, heapSize, i, callBack, hardCallBack) {
  const leftIndex = i * 2 + 1
  const rightIndex = i * 2 + 2
  let biggestValueIndex = i
  hardCallBack()

  if (leftIndex < heapSize && arr[leftIndex] > arr[biggestValueIndex]) {
    biggestValueIndex = leftIndex
    hardCallBack()
  }
  if (rightIndex < heapSize && arr[rightIndex] > arr[biggestValueIndex]) {
    biggestValueIndex = rightIndex
    hardCallBack()
  }

  if (biggestValueIndex !== i) {
    const temp = arr[i]
    arr[i] = arr[biggestValueIndex]
    arr[biggestValueIndex] = temp
    await callBack()
    await heapify(arr, heapSize, biggestValueIndex, callBack, hardCallBack)
  }
}

/**
 * @type {SortFunction}
 */
async function MergeSort(arr, callBack, hardCallBack) {
  const len = arr.length
  let left_s, left_e, right_s, right_e

  for (let i = 1; i < len; i *= 2) {
    for (left_s = 0; left_s < len; left_s = right_e) {
      let next = left_s
      left_e = right_s = left_s + i
      right_e = right_s + i
      hardCallBack()

      if (right_e > len) right_e = len

      const left_list = arr.slice(left_s, left_e)

      let left_index = 0

      while (left_index < left_list.length) {
        if (right_s >= right_e || left_list[left_index] <= arr[right_s]) {
          arr[next++] = left_list[left_index++]
          await callBack()
        } else {
          arr[next++] = arr[right_s++]
          await callBack()
        }
      }
    }
  }
}

/**
 * @type {SortFunction}
 */
async function MergeSortWorker(arr, callBack, hardCallBack) {
  const len = arr.length
  let left_s, left_e, right_s, right_e

  for (let i = 1; i < len; i *= 2) {
    /**
     * @type {{ buffer: ArrayBuffer, offset: number }[]}
     */
    const task = []

    for (left_s = 0; left_s < len; left_s = right_e) {
      left_e = right_s = left_s + i
      right_e = right_s + i
      hardCallBack()

      if (right_e > len) right_e = len

      // console.log(`i = ${i}, left_s = ${left_s}, left_e = ${left_e}, right_s = ${right_s}, right_e = ${right_e}`)

      const trs = new Uint16Array(right_e - left_s + 4)
      trs.set([left_s, left_e, right_s, right_e])
      trs.set(arr.slice(left_s, right_e), 4)

      task.push({
        buffer: trs.buffer,
        offset: left_s,
      })
    }

    await Promise.all(
      task.map(async t => {
        const worker = await pick_one_worker(merge_workers)
        const rawAns = await worker.transferAndRetrieve(t.buffer)
        const ans = new Uint16Array(rawAns)
        const realAns = ans.slice(1)
        hardCallBack(ans[0])
        arr.set(realAns, t.offset)
      })
    )
    // console.log('ok')
    await callBack()
  }
}

/**
 * @type {SortFunction}
 */
async function InsertionSort(array, callBack, hardCallBack) {
  let len = array.length
  for (let i = 0; i < len; i++) {
    let temp = array[i]
    let j = i - 1
    while (j >= 0 && array[j] > temp) {
      array[j + 1] = array[j]
      await callBack()
      j--
    }
    array[j + 1] = temp
    await callBack()
  }
}

/**
 * @type {SortFunction}
 */
async function SelectionSort(array, callBack, hardCallBack) {
  let len = array.length
  for (let i = 0; i < len - 1; i++) {
    let minIndex = i
    hardCallBack()
    for (let j = i + 1; j < len; j++) {
      hardCallBack()
      if (array[j] < array[minIndex]) {
        minIndex = j
      }
    }
    if (minIndex != i) {
      ;[array[minIndex], array[i]] = [array[i], array[minIndex]]
      await callBack()
    }
  }
}

/**
 * @type {SortFunction}
 */
async function ShellSort(arr, callBack, hardCallBack) {
  const len = arr.length
  for (let gap = Math.floor(len / 2); gap > 0; gap = Math.floor(gap / 2)) {
    for (let i = gap; i < len; i++) {
      let j = i
      const current = arr[i]
      while (j - gap >= 0 && current < arr[j - gap]) {
        arr[j] = arr[j - gap]
        j = j - gap
        await callBack()
      }
      arr[j] = current
      await callBack()
    }
  }
}

/**
 * @type {SortFunction}
 */
async function MonkeySort(arr, callBack, hardCallBack) {
  do {
    for (let i = 0; i < arr.length - 1; i++) {
      const rIndex = getRandomInt(i + 1, arr.length - 1)
      const tmp = arr[i]
      arr[i] = arr[rIndex]
      arr[rIndex] = tmp
      await callBack()
    }
  } while (!isSorted(arr))
}
