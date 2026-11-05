import scenarios from './data/scenariosA1.json' with {type:'json'}
import scenariosA2 from './data/scenariosA2.json' with {type:'json'}
import scenariosB1 from './data/scenariosB1.json' with {type:'json'}
import scenariosB2 from './data/scenariosB2.json' with {type:'json'}
import {wordKey} from './word-model.js'

export const grammarScenarios=[...scenarios,...scenariosA2,...scenariosB1,...scenariosB2]

export function completedScenarioWordKeys(progress,level=null) {
  const keys=new Set()
  for(const scenario of grammarScenarios){
    if(level&&scenario.level!==level)continue
    if(!progress[scenario.id]?.done)continue
    for(const raw of scenario.sceneWords){
      const term=raw.replace(/（[^）]*）/gu,'').trim()
      const match=/^(der|die|das)\s+(.+)$/u.exec(term)
      keys.add(wordKey({german:match?match[2]:term,article:match?match[1]:''}))
    }
  }
  return keys
}
