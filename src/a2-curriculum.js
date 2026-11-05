// A2-0 final order. Later packages add content at these positions.
export const A2_UNIT_ORDER=[
  'p-a2-01','p-a2-02','g-a2-01','g-a2-02','g-a2-03','t-a2-03',
  'g-a2-04','g-a2-05','g-a2-06','g-a2-07','g-a2-08','g-a2-09',
  'g-a2-10','g-a2-11','g-a2-12','g-a2-13','t-a2-02','g-a2-14',
  'g-a2-15','g-a2-16','g-a2-17','t-a2-01','g-a2-18','t-a2-05',
  'g-a2-19','g-a2-20','g-a2-21','g-a2-22','t-a2-04',
]

export const A2_COMPARISON_ORDER=['c-a2-1','c-a2-2','c-a2-3','c-a2-4','c-a2-5']
export const A2_SCENARIO_ORDER=Array.from({length:10},(_,index)=>`s-a2-${String(index+1).padStart(2,'0')}`)
