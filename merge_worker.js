onmessage = function (e) {
  if (e.data instanceof ArrayBuffer) {
    const data = new Uint16Array(e.data)

    // console.log(data)
    let [left_s, left_e, right_s, right_e] = data
    let step = 0
    const partialArr = data.slice(4) // arr.slice(left_s, right_e)

    // console.log(`[Worker] left_s = ${left_s}, left_e = ${left_e}, right_s = ${right_s}, right_e = ${right_e}`)
    // console.log('[Worker]', partialArr)

    const left_list = partialArr.slice(0, left_e - left_s)
    let next = 0

    let left_index = 0

    while (left_index < left_list.length) {
      if (right_s >= right_e || left_list[left_index] <= partialArr[right_s - left_s]) {
        partialArr[next++] = left_list[left_index++]
        ++step
      }
      else {
        partialArr[next++] = partialArr[right_s++ - left_s]
        ++step
      }
    }

    const retArr = new Uint16Array(partialArr.length + 1)
    retArr.set([step])
    retArr.set(partialArr, 1)

    const buf = retArr.buffer
    // console.log('[Worker], ready to finish')
    postMessage(buf, [buf])
  }
}