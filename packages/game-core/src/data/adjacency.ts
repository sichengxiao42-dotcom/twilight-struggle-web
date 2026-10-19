import { COUNTRIES } from './countries';
// Source: GMT board https://www.gmtgames.com/nnts/NewTSmap7.jpg
// Connections are board links, not geographic borders.
const links = `
canada:uk
uk:norway,benelux,france
norway:sweden
sweden:finland,denmark
denmark:west_germany
benelux:west_germany
france:west_germany,italy,spain_portugal,algeria
spain_portugal:italy,morocco
italy:austria,yugoslavia,greece
west_germany:east_germany,austria
austria:east_germany,hungary
east_germany:poland,czechoslovakia
poland:czechoslovakia
czechoslovakia:hungary
hungary:yugoslavia,romania
yugoslavia:romania,greece
romania:bulgaria
bulgaria:greece,turkey
greece:turkey
turkey:syria
lebanon:syria,israel
syria:israel,iraq
israel:jordan,egypt
iraq:jordan,iran,saudi_arabia,gulf_states
iran:afghanistan,pakistan
libya:egypt,tunisia
egypt:sudan
jordan:saudi_arabia
saudi_arabia:gulf_states
afghanistan:pakistan
pakistan:india
india:burma
burma:laos_cambodia
laos_cambodia:thailand,vietnam
thailand:vietnam,malaysia
malaysia:indonesia,australia
indonesia:philippines
philippines:japan
japan:south_korea,taiwan
south_korea:north_korea,taiwan
morocco:algeria,west_african_states
algeria:tunisia,saharan_states
west_african_states:ivory_coast
ivory_coast:nigeria
saharan_states:nigeria
nigeria:cameroon
cameroon:zaire
zaire:angola,zimbabwe
angola:south_africa,botswana
south_africa:botswana
botswana:zimbabwe
zimbabwe:se_african_states
se_african_states:kenya
kenya:somalia
somalia:ethiopia
ethiopia:sudan
mexico:guatemala
guatemala:el_salvador,honduras
el_salvador:honduras
honduras:costa_rica,nicaragua
costa_rica:nicaragua,panama
panama:colombia
nicaragua:cuba
cuba:haiti
haiti:dominican_rep
venezuela:colombia,brazil
colombia:ecuador
ecuador:peru
peru:bolivia,chile
brazil:uruguay
bolivia:paraguay
paraguay:uruguay,argentina
chile:argentina
argentina:uruguay
`;
export const ADJACENCY: Record<string, string[]> = Object.fromEntries(COUNTRIES.map(c => [c.id, []]));
for (const line of links.trim().split('\n')) {
  const [from, targets] = line.split(':');
  for (const to of targets.split(',')) {
    if (!ADJACENCY[from] || !ADJACENCY[to]) throw new Error('Unknown country');
    if (!ADJACENCY[from].includes(to)) ADJACENCY[from].push(to);
    if (!ADJACENCY[to].includes(from)) ADJACENCY[to].push(from);
  }
}
