import {h} from 'preact'

export default function CommentBox({
  value = '',
  maxLength = 200,
  placeholder = '输入评论...',
  onChange,
}) {
  let remaining = value.length

  return h('div', {class: 'wb-comment-box'},
    h('textarea', {
      class: 'wb-comment-box__textarea',
      value,
      placeholder,
      maxLength,
      onInput: onChange,
      rows: 3,
    }),
    h('div', {class: 'wb-comment-box__counter'},
      `${remaining}/${maxLength}`
    )
  )
}
