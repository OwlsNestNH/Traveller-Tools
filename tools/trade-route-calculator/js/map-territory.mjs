// SPDX-License-Identifier: Apache-2.0
// Boundary-walk adaptation of The Traveller Map.
// Upstream source copyright 2006-2023 Joshua Bell.
// Modified 2026-10-08: JavaScript/SVG implementation, integer lattice,
// buffer-aware stroke segments, validated metadata styles and inert markup.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy at https://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// Upstream notice: https://github.com/inexorabletash/travellermap/blob/main/LICENSE.md
//
// Traveller Map metadata borders are ordered boundary-HEX walks, not polygons
// through world centers. Follow the neighbor/corner walk in BorderPath, and the
// perimeter walk in ClipPath, using exact thirds/halves before projection.
// Sources (reviewed 2026-10-08):
// https://github.com/inexorabletash/travellermap/blob/main/server/RenderUtil.cs
// https://github.com/inexorabletash/travellermap/blob/main/server/Astrometrics.cs
// https://github.com/inexorabletash/travellermap/blob/main/server/RenderContext.cs
// https://github.com/inexorabletash/travellermap/blob/main/server/SectorStylesheet.cs
// https://github.com/inexorabletash/travellermap/blob/main/res/styles/otu.css

const CORNER_X=[-1,-2,-1,1,2,1],CORNER_Y=[1,0,-1,-1,0,1];
const same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
const key=([x,y])=>`${x},${y}`;
const valid=([x,y])=>x>=1&&x<=32&&y>=1&&y<=40;
const validSector=s=>Number.isSafeInteger(s?.x)&&Number.isSafeInteger(s?.y);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function neighbor([x,y],direction){
 const odd=x%2;
 return [[x-1,y+1-odd],[x-1,y-odd],[x,y-1],[x+1,y-odd],[x+1,y+1-odd],[x,y+1]][direction];
}
function corner([x,y],index){
 // Integer lattice: x thirds and y halves. Local even-numbered columns
 // stagger downward, including buffer columns 00 and 33.
 return [3*(x-1)+CORNER_X[index],2*(y-40)+(x%2===0?1:0)+CORNER_Y[index]];
}
function parsePath(path){
 if(typeof path!=='string'||!path.trim()||path.length>65536)return null;
 const tokens=path.trim().split(/\s+/);
 if(tokens.length>8192||tokens.some(token=>!/^\d{4}$/.test(token)))return null;
 const hexes=tokens.map(token=>[Number(token.slice(0,2)),Number(token.slice(2))]);
 // Only sector hexes and the documented one-hex closure buffer are meaningful.
 return hexes.every(([x,y])=>x<=33&&y<=41)?hexes:null;
}

function traceBoundary(hexes){
 const members=new Set(hexes.map(key)),start=hexes[0],points=[corner(start,0)],edges=[];
 let firstDirection=0;
 for(let index=0;index<hexes.length;index++){
  const hex=hexes[index];let lastDirection=firstDirection+5;
  if(index&&same(hex,start)){
   lastDirection=5;
   if(firstDirection<3)break;
  }
  let direction=firstDirection;
  for(let check=firstDirection;check<=lastDirection;check++){
   direction=check;
   if(members.has(key(neighbor(hex,check%6))))break;
   const a=corner(hex,check%6),b=corner(hex,(check+1)%6);
   points.push(b);
   // Buffer cells close the fill outside this sector. They must never become
   // political border strokes when that fill is clipped at a sector seam.
   if(valid(hex))edges.push([a,b]);
  }
  firstDirection=(direction+4)%6;
 }
 // BorderPath closes even an unclosed metadata walk. Draw its closing edge
 // only when it really is an exposed hex edge, never an invented closing chord.
 const last=points.at(-1),first=points[0];
 if(!same(last,first))for(const hex of [start,hexes.at(-1)]){
  if(!valid(hex))continue;
  let found=false;
  for(let d=0;d<6;d++)if(same(corner(hex,d),last)&&same(corner(hex,(d+1)%6),first)&&!members.has(key(neighbor(hex,d)))){
   edges.push([last,first]);found=true;break;
  }
  if(found)break;
 }
 if(points.length>1&&same(points[0],points.at(-1)))points.pop();
 const strokes=[];
 for(const [a,b] of edges){
  const previous=strokes.at(-1);
  if(previous&&same(previous.at(-1),a))previous.push(b);
  else strokes.push([a,b]);
 }
 // Join the wraparound stroke for dash continuity, without crossing buffers.
 if(strokes.length>1&&same(strokes.at(-1).at(-1),strokes[0][0])){
  const firstStroke=strokes.shift();strokes.at(-1).push(...firstStroke.slice(1));
 }
 return {points,strokes};
}

function inWorld(point,sector){
 // The overview's projected world space is official HexToCenter + (.5,.5).
 return [32*sector.x+point[0]/3,40*sector.y+point[1]/2];
}

/** Pure geometry in the same staggered world space accepted by overview project(). */
export function borderGeometry(path,sector){
 const hexes=parsePath(path);
 if(!hexes||!validSector(sector))return null;
 const {points,strokes}=traceBoundary(hexes);
 if(points.length<3)return null;
 return {fill:points.map(point=>inWorld(point,sector)),strokes:strokes.map(line=>line.map(point=>inWorld(point,sector)))};
}

const perimeter=[];
for(let x=1;x<=32;x++)perimeter.push([x,1]);
for(let y=2;y<=40;y++)perimeter.push([32,y]);
for(let x=31;x>=1;x--)perimeter.push([x,40]);
for(let y=39;y>=1;y--)perimeter.push([1,y]);
const footprint=traceBoundary(perimeter).points;

/** Exact sector footprint, including the staggered edges, used only as a clip. */
export function sectorFootprint(sector){return validSector(sector)?footprint.map(point=>inWorld(point,sector)):[];}

// Named colors are data, never browser CSS source. Functions, URLs, variables,
// system colors and arbitrary declarations are deliberately unsupported.
const NAMED_COLORS=new Set(('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen').split(' '));
function safeColor(value){
 if(typeof value!=='string')return null;
 const color=value.trim().toLowerCase();
 if(/^#[\da-f]{6}$/.test(color)||NAMED_COLORS.has(color))return color;
 if(/^#[\da-f]{3}$/.test(color))return '#'+[...color.slice(1)].map(c=>c+c).join('');
 return null;
}
function safeStyle(value){return typeof value==='string'&&/^(solid|dashed|dotted|none)$/i.test(value.trim())?value.trim().toLowerCase():null;}
const OFFICIAL_COLORS=new Map();
for(const [codes,color] of [
 ['ImDa ImDc ImDd ImDg ImDi ImDs ImDv Im','#e32736'],
 ['ImLa ImSy ImLc ImAp ImLu ImVd SoNS SoRD SoWu ZhCa ZhCh ZhCo ZhIa ZhIN ZhJp ZhMe ZhOb ZhSh ZhVQ Zh JuPr','blue'],
 ['SoCf','orange'],['As AsXX','yellow'],['HvFd','purple'],['KkTw Kk','green'],
 ['JAOz JMen JUkh','teal'],['JAsi JHhk JVug','lightblue'],['JCoK JLum JuRu','cyan'],
 ['JPSt','aquamarine'],['JRar','olivedrab'],['JuHl','steelblue']
])for(const code of codes.split(' '))OFFICIAL_COLORS.set(code,color);

function stylesheetRules(source){
 if(typeof source!=='string'||source.length>65536)return [];
 const clean=source.replace(/\/\*[\s\S]*?\*\//g,''),rules=[];
 for(const match of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
  const selectors=match[1].split(',').map(selector=>selector.trim());
  // A small subset of Traveller Map's stylesheet grammar. No CSS is emitted.
  if(selectors.some(selector=>! /^[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)?$/.test(selector)))continue;
  const declarations={};
  for(const declaration of match[2].split(';')){
   const property=declaration.match(/^\s*(color|style)\s*:\s*([^:;]+)\s*$/i);
   if(!property)continue;
   const name=property[1].toLowerCase(),value=name==='color'?safeColor(property[2]):safeStyle(property[2]);
   if(value)declarations[name]=value;
  }
  for(const selector of selectors){
   const [element,code]=selector.split('.');
   if(element==='border')rules.push({code,specificity:code?2:1,declarations});
  }
 }
 return rules;
}
function borderStyle(border,rules){
 const code=typeof border.Allegiance==='string'?border.Allegiance:'';
 const values={color:OFFICIAL_COLORS.get(code)||'gray',style:'solid'};
 const specificity={color:OFFICIAL_COLORS.has(code)?2:0,style:0};
 // Like the upstream stylesheet, exact codes are case-sensitive, later equal
 // specificity wins, and a generic border rule cannot replace an exact rule.
 // Do not guess a faction from its prefix or recolor it from allegiance names.
 for(const rule of rules)if(rule.code===undefined||rule.code===code)for(const [name,value] of Object.entries(rule.declarations)){
  if(rule.specificity>=specificity[name]){values[name]=value;specificity[name]=rule.specificity;}
 }
 values.color=safeColor(border.Color)||values.color;
 values.style=safeStyle(border.Style)||values.style;
 return values;
}
const number=value=>String(Number(value.toFixed(6)));
function pathData(points,project,closed=false){
 const mapped=points.map(([x,y])=>project(x,y));
 if(!mapped.length||mapped.some(point=>!Array.isArray(point)||point.length<2||!point.slice(0,2).every(Number.isFinite)))return '';
 return mapped.map(([x,y],i)=>`${i?'L':'M'}${number(x)},${number(y)}`).join('')+(closed?'Z':'');
}
function clipId(path,index){
 // Projection-specific IDs prevent cross-SVG collisions when a page contains
 // multiple maps. Identical clips may safely share the same geometry.
 let hash=2166136261;
 for(let i=0;i<path.length;i++)hash=Math.imul(hash^path.charCodeAt(i),16777619);
 return `territory-clip-${index}-${(hash>>>0).toString(16)}`;
}

/** Inert SVG layer; callers put this before grids, worlds, route and labels. */
export function territoryMarkup({sectors,metadata,project}){
 if(!Array.isArray(sectors)||typeof metadata?.get!=='function'||typeof project!=='function')return '';
 const defs=[],groups=[];
 for(const [index,sector] of sectors.entries()){
  if(!validSector(sector))continue;
  const data=metadata.get(sector.name);
  if(!Array.isArray(data?.Borders)||!data.Borders.length)continue;
  const rules=stylesheetRules(data.Stylesheet),fills=[],strokes=[];
  for(const border of data.Borders){
   if(!border||typeof border!=='object')continue;
   const geometry=borderGeometry(border.Path,sector);
   if(!geometry)continue;
   const fill=pathData(geometry.fill,project,true);
   if(!fill)continue;
   const {color,style}=borderStyle(border,rules),tag=`data-allegiance="${esc(border.Allegiance)}"`;
   fills.push(`<path class="territory-fill" ${tag} d="${fill}" fill="${color}" fill-opacity="0.11" fill-rule="evenodd" stroke="none"/>`);
   const stroke=style==='none'?'':geometry.strokes.map(points=>pathData(points,project)).filter(Boolean).join('');
   if(stroke)strokes.push(`<path class="territory-border" ${tag} d="${stroke}" fill="none" stroke="${color}" stroke-opacity="0.62" stroke-width="0.9" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"${style==='dashed'?' stroke-dasharray="4 3"':style==='dotted'?' stroke-dasharray="0.8 2.4"':''}/>`);
  }
  if(!fills.length)continue;
  const clip=pathData(sectorFootprint(sector),project,true);
  if(!clip)continue;
  const id=clipId(clip,index);
  defs.push(`<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><path d="${clip}"/></clipPath>`);
  groups.push(`<g class="territory-sector" data-sector="${esc(sector.name)}" clip-path="url(#${id})">${fills.join('')}${strokes.join('')}</g>`);
 }
 return groups.length?`<g class="map-territories" aria-hidden="true" pointer-events="none"><defs>${defs.join('')}</defs>${groups.join('')}</g>`:'';
}
