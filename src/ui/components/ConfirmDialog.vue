<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"

import { activeConfirm, resolveConfirm } from "@/store/confirm"
import { strings } from "@/store/i18n"

const confirmButton = ref<HTMLButtonElement | null>(null)

watch(
  activeConfirm,
  async (request) => {
    if (!request) return
    await nextTick()
    confirmButton.value?.focus()
  },
  { immediate: true },
)

function onKeydown(event: KeyboardEvent): void {
  if (!activeConfirm.value || event.key !== "Escape") return
  event.preventDefault()
  event.stopImmediatePropagation()
  resolveConfirm(false)
}

onMounted(() => window.addEventListener("keydown", onKeydown, true))
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown, true))
</script>

<template>
  <div v-if="activeConfirm" class="bt-modal bt-modal--confirm" @click.self="resolveConfirm(false)">
    <section
      class="bt-modal__panel bt-modal__panel--confirm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="bt-confirm-title"
      aria-describedby="bt-confirm-message"
    >
      <header class="bt-modal__head">
        <span id="bt-confirm-title" class="bt-modal__title">{{ activeConfirm.title }}</span>
        <button type="button" class="bt-icon-btn" :aria-label="strings.closeDialog || 'Close'" @click="resolveConfirm(false)">
          <span class="bt-glyph">×</span>
        </button>
      </header>
      <div class="bt-modal__body">
        <p id="bt-confirm-message" class="bt-confirm__message">{{ activeConfirm.message }}</p>
      </div>
      <footer class="bt-modal__foot">
        <span class="bt-modal__hint" />
        <button type="button" class="bt-btn" @click="resolveConfirm(false)">{{ activeConfirm.cancelLabel }}</button>
        <button
          ref="confirmButton"
          type="button"
          class="bt-btn"
          :class="activeConfirm.danger ? 'bt-btn--danger' : 'bt-btn--primary'"
          @click="resolveConfirm(true)"
        >
          {{ activeConfirm.confirmLabel }}
        </button>
      </footer>
    </section>
  </div>
</template>
