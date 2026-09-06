// Single icon component. Replaces the Material Symbols font: each glyph is now an
// inline SVG from @material-symbols/svg-500 (outlined), bundled into the app so
// there is no font download and no flash of icon names on load.
//
// Weight 500, not 400: at the sizes used here the 400 cut read lighter than the
// hand-drawn view-toggle icons next to it. svg-400 is still installed as a
// fallback if this needs to go back.
//
// Usage:  <Icon name="menu" />            plain
//         <Icon name="star" filled />     swaps in the solid variant
//
// Sizing and colour still come from CSS via the shared `.icon` class — svgr's
// `icon: true` renders at 1em so the `font-size` rules in index.css keep working,
// and `fill: currentColor` makes it follow `color`.
//
// Adding an icon: copy the file from
// node_modules/@material-symbols/svg-500/outlined/<name>.svg into
// src/assets/icons/, then add one import + one ICONS entry below.

import Add from '../assets/icons/add.svg?react';
import ArrowBack from '../assets/icons/arrow_back.svg?react';
import Bookmark from '../assets/icons/bookmark.svg?react';
import BookmarkCheck from '../assets/icons/bookmark_check.svg?react';
import BookmarkCheckFill from '../assets/icons/bookmark_check-fill.svg?react';
import Casino from '../assets/icons/casino.svg?react';
import CasinoFill from '../assets/icons/casino-fill.svg?react';
import Category from '../assets/icons/category.svg?react';
import Check from '../assets/icons/check.svg?react';
import ChevronLeft from '../assets/icons/chevron_left.svg?react';
import ChevronRight from '../assets/icons/chevron_right.svg?react';
import Close from '../assets/icons/close.svg?react';
import Delete from '../assets/icons/delete.svg?react';
import Edit from '../assets/icons/edit.svg?react';
import ExpandMore from '../assets/icons/expand_more.svg?react';
import Favorite from '../assets/icons/favorite.svg?react';
import FavoriteFill from '../assets/icons/favorite-fill.svg?react';
import FormatListBulleted from '../assets/icons/format_list_bulleted.svg?react';
import Group from '../assets/icons/group.svg?react';
import History from '../assets/icons/history.svg?react';
import Inventory2 from '../assets/icons/inventory_2.svg?react';
import IosShare from '../assets/icons/ios_share.svg?react';
import List from '../assets/icons/list.svg?react';
import Menu from '../assets/icons/menu.svg?react';
import Mic from '../assets/icons/mic.svg?react';
import NorthWest from '../assets/icons/north_west.svg?react';
import PlaylistAdd from '../assets/icons/playlist_add.svg?react';
import Schedule from '../assets/icons/schedule.svg?react';
import Search from '../assets/icons/search.svg?react';
import Shuffle from '../assets/icons/shuffle.svg?react';
import Star from '../assets/icons/star.svg?react';
import StarFill from '../assets/icons/star-fill.svg?react';
import StarHalf from '../assets/icons/star_half.svg?react';
import TravelExplore from '../assets/icons/travel_explore.svg?react';
import Tune from '../assets/icons/tune.svg?react';
import WebStories from '../assets/icons/web_stories.svg?react';

const ICONS = {
  add: Add,
  arrow_back: ArrowBack,
  bookmark: Bookmark,
  bookmark_check: BookmarkCheck,
  'bookmark_check-fill': BookmarkCheckFill,
  casino: Casino,
  'casino-fill': CasinoFill,
  category: Category,
  check: Check,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  close: Close,
  delete: Delete,
  edit: Edit,
  expand_more: ExpandMore,
  favorite: Favorite,
  'favorite-fill': FavoriteFill,
  format_list_bulleted: FormatListBulleted,
  group: Group,
  history: History,
  inventory_2: Inventory2,
  ios_share: IosShare,
  list: List,
  menu: Menu,
  mic: Mic,
  north_west: NorthWest,
  playlist_add: PlaylistAdd,
  schedule: Schedule,
  search: Search,
  shuffle: Shuffle,
  star: Star,
  'star-fill': StarFill,
  star_half: StarHalf,
  travel_explore: TravelExplore,
  tune: Tune,
  web_stories: WebStories,
};

export default function Icon({ name, filled = false, className = '', ...rest }) {
  const Svg = (filled && ICONS[`${name}-fill`]) || ICONS[name];
  if (!Svg) {
    if (import.meta.env.DEV) console.warn(`<Icon>: unknown name "${name}"`);
    return null;
  }
  return <Svg className={`icon ${className}`.trim()} aria-hidden="true" {...rest} />;
}
