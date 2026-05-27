import assert from 'assert'
import {h} from 'preact'

import LibrarySideDrawer from '../../../src/components/workbench/shared/LibrarySideDrawer.js'
import {renderToDom} from '../preactTestHelper.js'

describe('LibrarySideDrawer golden path row routing', () => {
  it('opens projected kifu rows through onOpenLibraryTask', () => {
    const opened = []
    const {container, fireEvent} = renderToDom(
      h(LibrarySideDrawer, {
        open: true,
        type: 'kifu',
        libraryProjection: {
          kifu: [
            {
              id: 'task_kifu_fixture',
              taskId: 'task_kifu_fixture',
              title: 'Golden kifu fixture',
            },
          ],
        },
        onOpenLibraryTask: (row) => opened.push(row),
      }),
    )

    const button = Array.from(container.querySelectorAll('.wb-library-drawer__item button'))
      .find((item) => item.textContent.includes('Golden kifu fixture'))
    assert.ok(button, 'projected kifu row should render as a clickable row')

    fireEvent.click(button)

    assert.deepStrictEqual(opened.map((row) => row.taskId), [
      'task_kifu_fixture',
    ])
  })

  it('opens projected 101 rows through problem task routing', () => {
    const opened = []
    const {container, fireEvent} = renderToDom(
      h(LibrarySideDrawer, {
        open: true,
        type: 'problems',
        libraryProjection: {
          oneOhOne: {
            status: 'synced',
            rows: [
              {
                id: 'task_101_fixture',
                taskId: 'task_101_fixture',
                title: 'Golden 101 problem',
              },
            ],
          },
        },
        onStartProblem: (id, row) => opened.push({id, row}),
      }),
    )

    const button = Array.from(container.querySelectorAll('.wb-library-drawer__item button'))
      .find((item) => item.textContent.includes('Golden 101 problem'))
    assert.ok(button, 'projected 101 row should render as a clickable row')

    fireEvent.click(button)

    assert.deepStrictEqual(opened, [
      {
        id: 'task_101_fixture',
        row: {
          id: 'task_101_fixture',
          taskId: 'task_101_fixture',
          title: 'Golden 101 problem',
        },
      },
    ])
  })
})
