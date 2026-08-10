const COMMON_FUNCTION_WORDS = new Set(`
a about above after again against all am an and any are aren't as at be because been before being below between
both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from
further had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his
how how's i i'd i'll i'm i've if in into is isn't it it's its itself just let's me more most mustn't my myself no
nor not of off on once only or other ought our ours ourselves out over own same shan't she she'd she'll she's should
shouldn't so some such than that that's the their theirs them themselves then there there's these they they'd they'll
they're they've this those through to too under until up very was wasn't we we'd we'll we're we've were weren't what
what's when when's where where's which while who who's whom why why's will with won't would wouldn't you you'd you'll
you're you've your yours yourself yourselves every ever never always also already almost another around away back
become became becomes becoming beside besides beyond even everywhere former formerly forth forward hereafter hereby
herein hereupon however indeed inside less many may maybe might mine moreover much must near neither next nobody none
nothing nowhere often otherwise outside perhaps quite rather really several since sometimes still therefore thereafter
thereby therein thereupon together toward towards unless unlike upon via whatever whenever wherever whether whoever
whose within without yet yeah yo uh um oh aye im ive dont cant wont aint isnt wasnt didnt doesnt shouldnt couldnt
wouldnt gonna wanna gotta kinda sorta cause cuz tho though themself ourselves yall ya
`.trim().split(/\s+/));

export function isCommonFunctionWord(word: string) {
  return COMMON_FUNCTION_WORDS.has(word);
}

export function findLyricAnchor(text: string) {
  const lines = text.split(/\n+/).map(tokenize).filter((words) => words.length > 0);
  const candidates = new Map<string, { uses: number; endingUses: number; score: number; phrase: boolean }>();

  const addCandidate = (candidate: string, endingWeight: number, phrase: boolean) => {
    const current = candidates.get(candidate) ?? { uses: 0, endingUses: 0, score: 0, phrase };
    current.uses += 1;
    current.endingUses += endingWeight >= 5 ? 1 : 0;
    current.score += (phrase ? 3 : 1) + endingWeight;
    candidates.set(candidate, current);
  };

  lines.forEach((words) => {
    words.forEach((word, index) => {
      if (word.length < 3 || isCommonFunctionWord(word) || /^\d+$/.test(word)) return;
      const distanceFromEnd = words.length - 1 - index;
      const endingWeight = distanceFromEnd === 0 ? 5 : distanceFromEnd === 1 ? 2 : 0;
      addCandidate(word, endingWeight, false);

      const nextWord = words[index + 1];
      if (nextWord && nextWord.length >= 3 && !isCommonFunctionWord(nextWord) && !/^\d+$/.test(nextWord)) {
        const nextDistanceFromEnd = words.length - 2 - index;
        addCandidate(`${word} ${nextWord}`, nextDistanceFromEnd === 0 ? 5 : nextDistanceFromEnd === 1 ? 2 : 0, true);
      }
    });
  });

  return [...candidates.entries()]
    .filter(([, value]) => value.uses >= 2 && (value.endingUses >= 1 || value.uses >= 3))
    .sort((a, b) => b[1].score - a[1].score || Number(b[1].phrase) - Number(a[1].phrase) || b[1].endingUses - a[1].endingUses || b[1].uses - a[1].uses)[0]?.[0] ?? null;
}

export function tokenize(value: string) {
  return value.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}
