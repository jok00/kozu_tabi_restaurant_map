(function(){
  const cardSelector='.restaurantCard';
  const tagRowSelector='.restaurantCard .tags';
  let scheduled=false;

  function tagText(tag){
    return String(tag.textContent || '').trim();
  }

  function collectTagCounts(){
    const counts=new Map();
    document.querySelectorAll(cardSelector).forEach(card=>{
      const cardTags=new Set(Array.from(card.querySelectorAll('.tag')).map(tagText).filter(Boolean));
      cardTags.forEach(tag=>counts.set(tag,(counts.get(tag) || 0)+1));
    });
    return counts;
  }

  function sortTags(){
    const counts=collectTagCounts();
    document.querySelectorAll(tagRowSelector).forEach(row=>{
      const tags=Array.from(row.querySelectorAll(':scope > .tag'));
      const sorted=[...tags].sort((a,b)=>{
        const countDiff=(counts.get(tagText(b)) || 0)-(counts.get(tagText(a)) || 0);
        if(countDiff) return countDiff;
        return tagText(a).localeCompare(tagText(b),'ja');
      });
      if(sorted.some((tag,index)=>tag!==tags[index])){
        sorted.forEach(tag=>row.appendChild(tag));
      }
    });
  }

  function scheduleSort(){
    if(scheduled) return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      sortTags();
    });
  }

  scheduleSort();
  new MutationObserver(scheduleSort).observe(document.body,{childList:true,subtree:true});
}());