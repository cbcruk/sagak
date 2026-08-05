import type { ComponentChildren } from 'preact'
import { FontFamilySelect } from '../font-family-select/font-family-select'
import { FontSizeSelect } from '../font-size-select/font-size-select'
import { HeadingSelect } from '../heading-select/heading-select'
import { LinkDialog } from '../link-dialog/link-dialog'
import { ImageDialog } from '../image-dialog/image-dialog'
import { TableDialog } from '../table-dialog/table-dialog'
import { ColorPicker } from '../color-picker/color-picker'
import { AlignmentButtons } from '../alignment-buttons/alignment-buttons'
import { ListButtons } from '../list-buttons/list-buttons'
import { FindReplaceDialog } from '../find-replace-dialog/find-replace-dialog'
import { HorizontalRuleButton } from '../horizontal-rule-button/horizontal-rule-button'
import { LineHeightSelect } from '../line-height-select/line-height-select'
import { LetterSpacingSelect } from '../letter-spacing-select/letter-spacing-select'
import { SpecialCharacterDialog } from '../special-character-dialog/special-character-dialog'
import { MoreMenu } from '../more-menu/more-menu'
import { ExportMenu } from '../export-menu/export-menu'
import { FormatToggles } from '../format-toggles/format-toggles'
import { HistoryButtons } from '../history-buttons/history-buttons'



export function Toolbar(): ComponentChildren {

  return (
    <div data-scope="toolbar" data-part="root" role="toolbar" aria-label="Text formatting">
      <HistoryButtons />

      <div data-part="separator" />

      {/* Heading/Paragraph */}
      <HeadingSelect />

      <div data-part="separator" />

      <FormatToggles />

      {/* Colors */}
      <ColorPicker type="text" />
      <ColorPicker type="background" />

      <div data-part="separator" />

      {/* Font Family, Size - always visible */}
      <FontFamilySelect />
      <FontSizeSelect />

      {/* Line Height & Letter Spacing - hidden on mobile */}
      <div data-part="mobile-hidden" style={{ display: 'contents' }}>
        <LineHeightSelect />
        <LetterSpacingSelect />
      </div>

      <div data-part="separator" />

      {/* Alignment */}
      <AlignmentButtons />

      <div data-part="separator" />

      {/* Lists */}
      <ListButtons />

      {/* Link, Image, Table, HR, Special Characters - hidden on mobile */}
      <div data-part="mobile-hidden" style={{ display: 'contents' }}>
        <div data-part="separator" />
        <div style={{ display: 'flex', gap: 4 }}>
          <LinkDialog />
          <ImageDialog />
          <TableDialog />
          <HorizontalRuleButton />
          <SpecialCharacterDialog />
        </div>

        <div data-part="separator" />

        {/* Find & Export */}
        <div style={{ display: 'flex', gap: 4 }}>
          <FindReplaceDialog />
          <ExportMenu />
        </div>
      </div>

      {/* More Menu - visible on mobile */}
      <MoreMenu />
    </div>
  )
}
